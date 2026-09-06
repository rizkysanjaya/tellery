"""
=============================================================================
Module: src.api.routes.media
Purpose: REST API endpoints for media ingestion, timeline queries, EXIF filtering,
         batch ZIP downloads, soft-delete data recovery, and multi-vault permissions enforcement.
Used by: src.api.app, frontend/src/api.ts
Dependencies: fastapi, pydantic, src.database.repository, src.services.archive_service,
              src.services.vault_service, src.services.upload_tracker, src.services.zip_export_service
Public Members: router, get_timeline, get_stats, get_filter_metadata, upload_media,
                delete_media_item, restore_media_item, delete_media_permanently, empty_trash
Side Effects: Spools uploaded files, updates SQLite rows, executes soft-deletes, triggers ZIP streaming.
=============================================================================
"""

from collections import defaultdict
from datetime import datetime
import logging
from pathlib import Path
import re
from typing import Optional
import uuid

logger = logging.getLogger(__name__)

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from src.api.schemas import (
    MediaItemResponse,
    StatsResponse,
    TimelineGroup,
    TimelineResponse,
    FavoriteMediaRequest,
    BulkFavoriteMediaRequest,
    RestoreMediaBatchRequest,
    BatchDownloadRequest,
    TrashResponse,
    FilterMetadataResponse,
)
from src.database.repository import MediaRepository
from src.services.archive_service import ArchiveService
from src.services.upload_tracker import get_upload_tracker
from src.services.zip_export_service import get_zip_export_service

router = APIRouter(prefix="/api/media", tags=["Media Catalog"])


def _format_bytes(size_bytes: int) -> str:
    """Formats raw byte count into human-readable representation."""
    if size_bytes >= 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"
    elif size_bytes >= 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    elif size_bytes >= 1024:
        return f"{size_bytes / 1024:.2f} KB"
    return f"{size_bytes} B"


def _format_period_title(period_key: Optional[str]) -> str:
    """Converts '2026-08' to 'August 2026'."""
    if not period_key:
        return "Unknown Date"
    try:
        dt = datetime.strptime(period_key, "%Y-%m")
        return dt.strftime("%B %Y")
    except Exception:
        return period_key


def _compute_group_key_and_title(item: dict, sort_by: str) -> tuple[str, str]:
    """Computes grouping key and human-friendly section title based on active sort mode."""
    if sort_by.startswith("name"):
        file_name = item.get("file_name", "").strip()
        first_char = file_name[0].upper() if file_name else "#"
        if first_char.isalpha():
            return f"letter_{first_char}", f"Letter {first_char}"
        elif first_char.isdigit():
            return "numbers", "Numbers (0-9)"
        else:
            return "symbols", "Symbols & Other (#)"
    elif sort_by.startswith("size"):
        size = item.get("file_size", 0)
        if size >= 100 * 1024 * 1024:
            return "size_large", "Large (> 100 MB)"
        elif size >= 25 * 1024 * 1024:
            return "size_med_large", "Medium-Large (25 MB – 100 MB)"
        elif size >= 5 * 1024 * 1024:
            return "size_med", "Medium (5 MB – 25 MB)"
        else:
            return "size_compact", "Compact (< 5 MB)"
    else:
        # Default chronological month/year grouping
        key = item.get("period_key") or "unknown"
        return key, _format_period_title(key)


def _to_media_response(item: dict) -> MediaItemResponse:
    """Maps database row dict to MediaItemResponse with computed API endpoints."""
    item_id = item["id"]
    thumb_url = f"/api/media/{item_id}/thumbnail"
    return MediaItemResponse(
        id=item_id,
        file_name=item["file_name"],
        file_size=item["file_size"],
        mime_type=item["mime_type"],
        width=item.get("width"),
        height=item.get("height"),
        duration_seconds=item.get("duration_seconds"),
        camera_make=item.get("camera_make"),
        camera_model=item.get("camera_model"),
        date_taken=item.get("date_taken"),
        thumbnail_url=thumb_url,
        stream_url=f"/api/media/{item_id}/stream",
        created_at=item["created_at"],
        folder_id=item.get("folder_id"),
        folder_name=item.get("folder_name"),
        is_favorite=bool(item.get("is_favorite", 0)),
        deleted_at=item.get("deleted_at"),
    )


@router.get("", response_model=TimelineResponse)
async def get_timeline(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    type: Optional[str] = Query(None, pattern="^(photo|video|all)$"),
    q: Optional[str] = Query(None, description="Search query by filename or camera model"),
    folder_id: Optional[int] = Query(None, description="Filter by virtual folder ID"),
    sort_by: str = Query("date_desc", pattern="^(date_desc|date_asc|name_asc|name_desc|size_desc|size_asc)$"),
    only_favorites: bool = Query(False, description="Filter to only favorited media items"),
    camera: Optional[str] = Query(None, description="Filter by camera make or model"),
    orientation: Optional[str] = Query(None, pattern="^(landscape|portrait|square)$", description="Filter by media orientation"),
    min_resolution: Optional[str] = Query(None, pattern="^(4k|fhd)$", description="Filter by minimum resolution"),
    year: Optional[int] = Query(None, description="Filter by calendar year"),
    month: Optional[str] = Query(None, description="Filter by ISO month (e.g. 2026-08)"),
    channel_id: Optional[int] = Query(None, description="Filter timeline by Telegram channel ID"),
):
    """
    Retrieves chronological or attribute-sorted timeline feed.
    Supports filtering by media type, search keyword, virtual folder, custom sorting, favorites,
    smart EXIF camera make/model, orientation, resolution, calendar periods, and multi-vault channel partitioning.
    """
    filter_type = type if type in ("photo", "video") else None
    
    # Determine target vault channel
    target_channel = channel_id
    if target_channel is None:
        from src.services.vault_service import get_vault_service
        target_channel = get_vault_service().get_active_channel_id()

    total_count, raw_items = await MediaRepository.get_timeline(
        offset=offset,
        limit=limit,
        media_type=filter_type,
        search_query=q,
        folder_id=folder_id,
        sort_by=sort_by,
        only_favorites=only_favorites,
        camera=camera,
        orientation=orientation,
        min_resolution=min_resolution,
        year=year,
        month=month,
        channel_id=target_channel,
    )

    # Group items preserving active sort order
    groups_dict: dict[str, tuple[str, list[MediaItemResponse]]] = {}
    for item in raw_items:
        key, title = _compute_group_key_and_title(item, sort_by)
        if key not in groups_dict:
            groups_dict[key] = (title, [])
        groups_dict[key][1].append(_to_media_response(item))

    groups = [
        TimelineGroup(
            period=title,
            period_key=key,
            count=len(items),
            items=items,
        )
        for key, (title, items) in groups_dict.items()
    ]

    has_more = (offset + limit) < total_count

    return TimelineResponse(
        total_count=total_count,
        has_more=has_more,
        groups=groups,
    )


_cached_tele_profile: dict[str, Optional[str]] = {
    "account_name": None,
    "account_username": None,
    "channel_name": None,
}


async def get_telegram_profile_info() -> dict[str, Optional[str]]:
    """
    Fetches and caches the authorized Telegram user profile and target vault channel title.
    Returns in-memory cached metadata with zero database/network latency on subsequent calls.
    """
    global _cached_tele_profile
    if _cached_tele_profile["account_name"] and _cached_tele_profile["channel_name"]:
        return _cached_tele_profile

    try:
        from src.storage.telegram_client import get_telegram_client
        from src.config import get_settings

        client = get_telegram_client()
        await client.start()
        settings = get_settings()

        avatar_dir = Path("data/avatars")
        avatar_dir.mkdir(parents=True, exist_ok=True)
        channel_avatar = avatar_dir / "channel_avatar.jpg"
        user_avatar = avatar_dir / "user_avatar.jpg"

        # 1. User profile & avatar
        me = await client.raw_client.get_me()
        if me:
            first = me.first_name or ""
            last = me.last_name or ""
            name = f"{first} {last}".strip() or me.username or "User"
            _cached_tele_profile["account_name"] = name
            _cached_tele_profile["account_username"] = me.username
            if not user_avatar.exists():
                try:
                    await client.raw_client.download_profile_photo(me, file=str(user_avatar))
                except Exception:
                    pass

        # 2. Target channel title & avatar
        channel = await client.get_target_entity(settings.tg_channel_id)
        if channel:
            _cached_tele_profile["channel_name"] = (
                getattr(channel, "title", None)
                or getattr(channel, "username", None)
                or "Vault"
            )
            if not channel_avatar.exists():
                try:
                    await client.raw_client.download_profile_photo(channel, file=str(channel_avatar))
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"[Telegram Profile] Failed to fetch profile info: {e}")

    return _cached_tele_profile


@router.get("/avatar/channel")
async def get_channel_avatar():
    """
    Serves the target Telegram vault channel's cached profile avatar.
    """
    avatar_path = Path("data/avatars/channel_avatar.jpg")
    if not avatar_path.exists():
        raise HTTPException(status_code=404, detail="Channel avatar not found")
    return FileResponse(
        avatar_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/avatar/user")
async def get_user_avatar():
    """
    Serves the logged-in Telegram account's cached profile avatar.
    """
    avatar_path = Path("data/avatars/user_avatar.jpg")
    if not avatar_path.exists():
        raise HTTPException(status_code=404, detail="User avatar not found")
    return FileResponse(
        avatar_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/stats", response_model=StatsResponse)
async def get_stats(channel_id: Optional[int] = Query(None, description="Filter stats by specific Telegram channel")):
    """
    Retrieves overall archive statistics (photo/video breakdown and total storage used)
    along with Telegram account and vault channel identity.
    """
    from src.services.vault_service import get_vault_service
    active_id = channel_id if channel_id is not None else get_vault_service().get_active_channel_id()
    stats = await MediaRepository.get_stats(channel_id=active_id)
    profile = await get_telegram_profile_info()
    avatar_dir = Path("data/avatars")
    channel_has_avatar = (avatar_dir / "channel_avatar.jpg").exists()
    user_has_avatar = (avatar_dir / "user_avatar.jpg").exists()

    return StatsResponse(
        total_items=stats["total_items"] or 0,
        total_photos=stats["total_photos"] or 0,
        total_videos=stats["total_videos"] or 0,
        total_size_bytes=stats["total_size_bytes"] or 0,
        total_size_formatted=_format_bytes(stats["total_size_bytes"] or 0),
        account_name=profile.get("account_name"),
        account_username=profile.get("account_username"),
        channel_name=profile.get("channel_name"),
        channel_avatar_url="/api/media/avatar/channel" if channel_has_avatar else None,
        user_avatar_url="/api/media/avatar/user" if user_has_avatar else None,
    )


@router.get("/filters/meta", response_model=FilterMetadataResponse)
async def get_filter_metadata(channel_id: Optional[int] = Query(None, description="Filter metadata by specific Telegram channel")):
    """
    Retrieves aggregate EXIF and chronological metadata for smart filtering and date scrubber.
    Cost: Indexed aggregate queries.
    """
    from src.services.vault_service import get_vault_service
    active_id = channel_id if channel_id is not None else get_vault_service().get_active_channel_id()
    meta = await MediaRepository.get_filter_metadata(channel_id=active_id)
    return FilterMetadataResponse(**meta)


@router.get("/upload/progress/{upload_id}")
async def get_upload_progress(upload_id: str):
    """
    Returns real-time byte transfer progress, percent, and operational status for an active upload.
    """
    tracker = get_upload_tracker()
    data = tracker.get_progress(upload_id)
    if not data:
        return {"status": "not_found", "percent": 0.0, "speed_mbps": 0.0}
    return data


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    upload_id: Optional[str] = Form(None),
    folder_id: Optional[int] = Form(None),
    channel_id: Optional[int] = Form(None),
):
    """
    Accepts direct multipart file upload from web UI,
    spools to temporary buffer, archives into Telegram MTProto vault with deduplication,
    optionally associates with a target virtual album/folder, and tracks real-time MTProto transfer.
    Enforces role permissions (blocks upload to read-only vaults).
    """
    from src.services.vault_service import get_vault_service
    vault_service = get_vault_service()
    target_channel_id = channel_id or vault_service.get_active_channel_id()
    if target_channel_id is not None:
        is_writable = await vault_service.is_vault_writable(target_channel_id)
        if not is_writable:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Read-Only Vault: You do not have permission to upload media to this channel.",
            )

    tracker = get_upload_tracker()
    temp_dir = Path("data/upload_temp")
    temp_dir.mkdir(parents=True, exist_ok=True)

    # 1. Strictly sanitize upload_id against path traversal attacks (CWE-22)
    if upload_id and re.match(r"^[a-zA-Z0-9_\-]+$", upload_id):
        unique_prefix = upload_id
    else:
        unique_prefix = uuid.uuid4().hex

    temp_file_dir = temp_dir / unique_prefix
    temp_file_dir.mkdir(parents=True, exist_ok=True)

    # 2. Strictly sanitize uploaded filename against path traversal & control characters
    raw_filename = file.filename or "upload.bin"
    clean_filename = Path(raw_filename).name.strip()
    clean_filename = "".join(c for c in clean_filename if c.isprintable() and c not in '<>:"/\\|?*\0')
    if not clean_filename or clean_filename in (".", ".."):
        clean_filename = f"upload_{uuid.uuid4().hex[:8]}.bin"

    temp_path = temp_file_dir / clean_filename

    # Maximum allowed payload: 2 GB (standard Telegram MTProto max document size)
    max_upload_bytes = 2 * 1024 * 1024 * 1024

    try:
        # 3. Stream incoming browser bytes to disk buffer with strict size ceiling
        bytes_spooled = 0
        with open(temp_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                bytes_spooled += len(chunk)
                if bytes_spooled > max_upload_bytes:
                    f.close()
                    if temp_path.exists():
                        temp_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"Uploaded file exceeds maximum allowed limit of {max_upload_bytes // (1024 * 1024)} MB.",
                    )
                f.write(chunk)

        total_bytes = temp_path.stat().st_size
        if upload_id:
            tracker.start_tracking(upload_id, total_bytes, clean_filename)

        # 4. Progress callback forwarding live Telegram MTProto transfer bytes to UI tracker
        def on_telegram_progress(curr: int, tot: int):
            if upload_id:
                tracker.update_progress(upload_id, curr, tot)

        archive_service = ArchiveService()
        result = await archive_service.archive_file(
            file_path=temp_path,
            mime_type=file.content_type,
            channel_id=target_channel_id,
            progress_callback=on_telegram_progress,
        )

        # 3. Associate with album/folder if requested
        media_item_id = result.get("media_id") or result.get("id")
        if folder_id and media_item_id:
            try:
                await MediaRepository.add_media_to_folder(folder_id, [int(media_item_id)])
                result["folder_id"] = folder_id
                # If file already exists in vault, linking to album fulfills the upload request cleanly
                if result.get("status") == "duplicate":
                    result["status"] = "completed"
                    result["message"] = "Media already archived in vault; linked to album."
            except Exception as folder_err:
                logger.warning(f"Failed to assign media {media_item_id} to folder {folder_id}: {folder_err}")

        if upload_id:
            tracker.set_status(upload_id, "completed")

        return result
    except Exception as e:
        if upload_id:
            tracker.set_status(upload_id, "error", str(e))
        raise e
    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass
        if temp_file_dir.exists():
            try:
                temp_file_dir.rmdir()
            except Exception:
                pass


@router.get("/{media_id:int}", response_model=MediaItemResponse)
async def get_media_item(media_id: int):
    """
    Retrieves metadata for a specific media item.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    return _to_media_response(item)


@router.delete("/{media_id:int}")
async def delete_media_item(media_id: int):
    """
    Soft deletes a media item (moves to Trash) while keeping Telegram message and local thumbnails safe.
    Enforces role permissions (blocks deletion on read-only vaults).
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    from src.services.vault_service import get_vault_service
    is_writable = await get_vault_service().is_vault_writable(item["telegram_channel_id"])
    if not is_writable:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-Only Vault: You do not have permission to delete media from this channel.",
        )

    archive_service = ArchiveService()
    try:
        result = await archive_service.delete_media_item(media_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to move media item to Trash: {e}")


@router.get("/trash", response_model=TrashResponse)
async def get_trash_media(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Retrieves paginated list of soft-deleted media items in Trash.
    """
    items = await MediaRepository.get_trash_items(limit=limit, offset=offset)
    total = await MediaRepository.get_trash_count()
    return TrashResponse(
        total=total,
        items=[_to_media_response(i) for i in items],
    )


@router.post("/{media_id:int}/restore")
async def restore_media_item(media_id: int):
    """
    Restores a soft-deleted media item from Trash back to the gallery.
    """
    archive_service = ArchiveService()
    try:
        result = await archive_service.restore_media_item(media_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore media item: {e}")


@router.post("/trash/restore")
async def restore_trash_batch(body: RestoreMediaBatchRequest):
    """
    Restores a batch of media items from Trash back to the gallery.
    """
    archive_service = ArchiveService()
    try:
        result = await archive_service.restore_batch(body.media_ids)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore batch: {e}")


@router.delete("/{media_id:int}/permanent")
async def delete_media_permanently(media_id: int):
    """
    Permanently deletes a media item from the Telegram vault, disk caches, and database.
    Enforces role permissions (blocks deletion on read-only vaults).
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    from src.services.vault_service import get_vault_service
    is_writable = await get_vault_service().is_vault_writable(item["telegram_channel_id"])
    if not is_writable:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-Only Vault: You do not have permission to delete media from this channel.",
        )

    archive_service = ArchiveService()
    try:
        result = await archive_service.purge_media_permanently(media_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to permanently delete media: {e}")


@router.post("/trash/empty")
async def empty_trash():
    """
    Permanently purges all items currently in Trash from Telegram storage and database.
    """
    archive_service = ArchiveService()
    try:
        result = await archive_service.empty_trash()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to empty Trash: {e}")


@router.post("/download-batch")
async def download_media_batch(
    body: BatchDownloadRequest,
    background_tasks: BackgroundTasks,
):
    """
    Creates and streams a ZIP archive containing the requested media items.
    Employs ZIP_STORED and kernel sendfile FileResponse to eliminate memory/CPU bloat.
    Automatically unlinks the temporary archive file upon completion.
    """
    if not body.media_ids:
        raise HTTPException(status_code=400, detail="No media items provided.")

    zip_service = get_zip_export_service()
    try:
        zip_path = await zip_service.create_batch_archive(body.media_ids)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_filename = f"telegallery_batch_{timestamp}.zip"

        background_tasks.add_task(zip_service.cleanup_archive, zip_path)
        return FileResponse(
            path=zip_path,
            media_type="application/zip",
            filename=export_filename,
            background=background_tasks,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate batch archive: {e}")


@router.get("/{media_id:int}/folders")
async def get_media_assigned_folders(media_id: int):
    """
    Retrieves all folders and albums that contain the specified media item.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    folders = await MediaRepository.get_media_folders(media_id)
    return folders


@router.post("/{media_id:int}/rename")
async def rename_media_item(media_id: int, payload: dict):
    """
    Renames the display file name of an existing media item in the catalog.
    """
    new_name = payload.get("new_name")
    if not new_name or not new_name.strip():
        raise HTTPException(status_code=400, detail="New filename cannot be empty")

    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    success = await MediaRepository.update_file_name(media_id, new_name.strip())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to rename media item")

    await MediaRepository.log_audit(
        action="MEDIA_RENAME",
        media_id=media_id,
        file_hash=item["file_hash"],
        details=f"Renamed from '{item['file_name']}' to '{new_name.strip()}'",
    )

    return {"status": "renamed", "media_id": media_id, "new_name": new_name.strip()}


@router.post("/{media_id:int}/alias")
async def create_duplicate_alias(media_id: int, payload: dict):
    """
    Creates a new catalog reference for a duplicate file with a new custom name,
    reusing the existing Telegram storage document without duplicating storage bytes.
    """
    new_name = payload.get("new_name")
    if not new_name or not new_name.strip():
        raise HTTPException(status_code=400, detail="New filename cannot be empty")

    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    alias_id = await MediaRepository.create_media_alias(media_id, new_name.strip())
    if not alias_id:
        raise HTTPException(status_code=500, detail="Failed to create duplicate alias entry")

    await MediaRepository.log_audit(
        action="ALIAS_CREATED",
        media_id=alias_id,
        file_hash=item["file_hash"],
        details=f"Created duplicate alias '{new_name.strip()}' referencing media {media_id}",
    )

    return {"status": "alias_created", "new_id": alias_id, "file_name": new_name.strip()}


@router.patch("/{media_id:int}/metadata")
async def update_media_metadata(media_id: int, payload: dict):
    """
    Updates client-extracted video metadata (duration_seconds, width, height) in SQLite.
    """
    duration_seconds = payload.get("duration_seconds")
    width = payload.get("width")
    height = payload.get("height")

    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    await MediaRepository.update_media_metadata(
        media_id=media_id,
        duration_seconds=float(duration_seconds) if duration_seconds is not None else None,
        width=int(width) if width is not None else None,
        height=int(height) if height is not None else None,
    )

    return {"status": "updated", "media_id": media_id}


@router.patch("/{media_id:int}/favorite")
async def toggle_favorite(media_id: int, payload: FavoriteMediaRequest):
    """
    Toggles favorite status for a single media item.
    Cost: O(1) indexed point update.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    success = await MediaRepository.update_favorite(media_id, payload.is_favorite)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update favorite status")

    return {"status": "ok", "media_id": media_id, "is_favorite": payload.is_favorite}


@router.post("/favorite/bulk")
async def bulk_toggle_favorite(payload: BulkFavoriteMediaRequest):
    """
    Batch updates favorite status for multiple media items.
    Cost: O(K) where K = len(media_ids).
    """
    updated_count = await MediaRepository.bulk_update_favorite(payload.media_ids, payload.is_favorite)
    return {"status": "ok", "updated_count": updated_count, "is_favorite": payload.is_favorite}


