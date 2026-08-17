"""
=============================================================================
Module: src.api.routes.media
Purpose: REST endpoints for media catalog timeline feeds, item details, and archive stats.
Used by: Web Gallery UI, Frontend clients.
Dependencies: fastapi, datetime, src.database.repository, src.api.schemas
Public Members: router
Side Effects: Reads SQLite catalog records.
=============================================================================
"""

from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from src.api.schemas import (
    MediaItemResponse,
    StatsResponse,
    TimelineGroup,
    TimelineResponse,
)
from src.database.repository import MediaRepository
from src.services.archive_service import ArchiveService

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
    )


@router.get("", response_model=TimelineResponse)
async def get_timeline(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    type: Optional[str] = Query(None, pattern="^(photo|video|all)$"),
    q: Optional[str] = Query(None, description="Search query by filename or camera model"),
    folder_id: Optional[int] = Query(None, description="Filter by virtual folder ID"),
):
    """
    Retrieves chronological timeline feed grouped by Year and Month.
    Supports filtering by media type, search keyword, and virtual folder.
    """
    filter_type = type if type in ("photo", "video") else None
    total_count, raw_items = await MediaRepository.get_timeline(
        offset=offset,
        limit=limit,
        media_type=filter_type,
        search_query=q,
        folder_id=folder_id,
    )

    # Group items by period_key (e.g. '2026-08')
    grouped_dict: dict[str, list[MediaItemResponse]] = defaultdict(list)
    for item in raw_items:
        period_key = item.get("period_key") or "unknown"
        grouped_dict[period_key].append(_to_media_response(item))

    groups = [
        TimelineGroup(
            period=_format_period_title(key),
            period_key=key,
            count=len(items),
            items=items,
        )
        for key, items in grouped_dict.items()
    ]

    has_more = (offset + limit) < total_count

    return TimelineResponse(
        total_count=total_count,
        has_more=has_more,
        groups=groups,
    )


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """
    Retrieves overall archive statistics (photo/video breakdown and total storage used).
    """
    stats = await MediaRepository.get_stats()
    return StatsResponse(
        total_items=stats["total_items"] or 0,
        total_photos=stats["total_photos"] or 0,
        total_videos=stats["total_videos"] or 0,
        total_size_bytes=stats["total_size_bytes"] or 0,
        total_size_formatted=_format_bytes(stats["total_size_bytes"] or 0),
    )


@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    """
    Accepts direct multipart file upload from web UI,
    spools to temporary buffer, and archives into Telegram MTProto vault with deduplication.
    """
    temp_dir = Path("data/upload_temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / file.filename

    try:
        # Stream incoming bytes to disk buffer (O(1) memory footprint)
        with open(temp_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)

        archive_service = ArchiveService()
        result = await archive_service.archive_file(
            file_path=temp_path,
            mime_type=file.content_type,
        )
        return result
    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
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
    Permanently deletes a media item from the Telegram vault,
    removes it from the SQLite catalog, and cleans up local thumbnail cache.
    """
    archive_service = ArchiveService()
    try:
        result = await archive_service.delete_media_item(media_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete media item: {e}")


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
