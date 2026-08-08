"""
=============================================================================
Module: src.api.routes.thumbnails
Purpose: Fast WebP thumbnail delivery endpoint with on-demand background generation
         for videos and photos missing cached thumbnails.
Used by: Gallery UI Grid, Lightbox previews, Folder Cover Cards.
Dependencies: fastapi, pathlib, tempfile, src.database.repository, src.config,
              src.services.thumbnail_service, src.storage.telegram_client
Public Members: router, get_media_thumbnail()
Side Effects: Reads cached WebP thumbnail files from disk; downloads first chunk
              from Telegram on-demand if thumbnail is missing and writes WebP to disk.
=============================================================================
"""

import tempfile
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from src.config import get_settings
from src.database.repository import MediaRepository
from src.services.thumbnail_service import generate_thumbnail
from src.storage.telegram_client import get_telegram_client

router = APIRouter(prefix="/api/media", tags=["Thumbnails"])


@router.get("/{media_id:int}/thumbnail")
async def get_media_thumbnail(media_id: int):
    """
    Serves the cached local WebP thumbnail with long-term browser cache headers.
    If the thumbnail was never generated (e.g. legacy video item), it fetches
    the media on-demand, generates the WebP thumbnail, updates SQLite, and serves it.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    settings = get_settings()
    file_hash = item["file_hash"]
    mime_type = item["mime_type"]
    thumb_path_str = item.get("thumbnail_path")

    # 1. Check existing recorded thumbnail path
    if thumb_path_str:
        thumb_file = Path(thumb_path_str)
        if thumb_file.exists() and thumb_file.stat().st_size > 0:
            return FileResponse(
                path=thumb_file,
                media_type="image/webp",
                headers={
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Content-Disposition": f"inline; filename={thumb_file.name}",
                },
            )

    # 2. Check if thumbnail exists in standard directory by hash
    candidate_thumb = settings.thumbnails_path / f"{file_hash}.webp"
    if candidate_thumb.exists() and candidate_thumb.stat().st_size > 0:
        await MediaRepository.update_thumbnail_path(media_id, str(candidate_thumb.as_posix()))
        return FileResponse(
            path=candidate_thumb,
            media_type="image/webp",
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Disposition": f"inline; filename={candidate_thumb.name}",
            },
        )

    # 3. On-demand generation from Telegram vault
    telegram_client = get_telegram_client()
    channel_id = item["telegram_channel_id"]
    message_id = item["telegram_message_id"]

    try:
        # Download file to temporary buffer to extract first frame / image
        suffix = Path(item["file_name"]).suffix or ".tmp"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp_path = Path(tmp.name)

        await telegram_client.download_document(
            channel_id=channel_id,
            message_id=message_id,
            destination=tmp_path,
        )

        generated_thumb = generate_thumbnail(
            file_path=tmp_path,
            file_hash=file_hash,
            mime_type=mime_type,
        )

        # Clean up temp file
        if tmp_path.exists():
            tmp_path.unlink()

        if generated_thumb and Path(generated_thumb).exists():
            await MediaRepository.update_thumbnail_path(media_id, generated_thumb)
            return FileResponse(
                path=Path(generated_thumb),
                media_type="image/webp",
                headers={
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Content-Disposition": f"inline; filename={Path(generated_thumb).name}",
                },
            )
    except Exception as e:
        print(f"[Thumbnail] On-demand thumbnail generation failed for media {media_id}: {e}")

    raise HTTPException(status_code=404, detail="Thumbnail not available for this item")
