"""
=============================================================================
Module: src.api.routes.thumbnails
Purpose: Fast WebP thumbnail delivery endpoint with browser caching headers.
Used by: Gallery UI Grid, Lightbox previews.
Dependencies: fastapi, pathlib, src.database.repository
Public Members: router
Side Effects: Reads cached WebP thumbnail files from local disk.
=============================================================================
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from src.database.repository import MediaRepository

router = APIRouter(prefix="/api/media", tags=["Thumbnails"])


@router.get("/{media_id:int}/thumbnail")
async def get_media_thumbnail(media_id: int):
    """
    Serves the cached local WebP thumbnail with long-term browser cache headers.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    thumbnail_path_str = item.get("thumbnail_path")
    if not thumbnail_path_str:
        raise HTTPException(status_code=404, detail="Thumbnail not available for this item")

    thumb_file = Path(thumbnail_path_str)
    if not thumb_file.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file missing from cache")

    return FileResponse(
        path=thumb_file,
        media_type="image/webp",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f"inline; filename={thumb_file.name}",
        },
    )
