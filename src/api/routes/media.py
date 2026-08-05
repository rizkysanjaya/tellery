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
    thumb_url = f"/api/media/{item_id}/thumbnail" if item.get("thumbnail_path") else None
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
