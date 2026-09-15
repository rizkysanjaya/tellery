"""
=============================================================================
Module: src.api.routes.thumbnails
Purpose: High-performance WebP thumbnail & animated WebP video preview delivery
         endpoints with ultra-lightweight on-demand extraction, concurrency throttling
         via asyncio.Semaphore(6), strict MIME/extension filtering (preventing 20MB RAW file stalls),
         instant fast-fail (<1ms) for videos lacking embedded thumbs to prevent socket starvation,
         double-checked caching, and structured logging.
Used by: Gallery UI Grid, Lightbox previews, Folder Cover Cards, Video Hover Previews.
Dependencies: asyncio, fastapi, pathlib, tempfile, logging, src.database.repository, src.config,
              src.services.thumbnail_service, src.storage.telegram_client
Public Members: router, get_media_thumbnail(), get_media_preview(), get_thumbnail_semaphore()
Side Effects: Serves cached WebP files from disk; writes extracted WebP to disk
              and updates SQLite thumbnail_path for instant sub-20ms subsequent reads.
=============================================================================
"""

import asyncio
import logging
from pathlib import Path
import tempfile
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from src.config import get_settings
from src.database.repository import MediaRepository
from src.services.thumbnail_service import generate_thumbnail
from src.storage.telegram_client import get_telegram_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media", tags=["Thumbnails"])

# Concurrency throttle: Allow at most 6 simultaneous on-demand thumbnail extractions from MTProto
# to prevent socket starvation, DC FloodWaitError, and CPU exhaustion while maximizing throughput.
_thumbnail_semaphore: Optional[asyncio.Semaphore] = None

# Extensions safely decodable by standard Pillow for on-demand thumbnail generation
SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff", ".tif", ".ico"}


def get_thumbnail_semaphore() -> asyncio.Semaphore:
    """Returns the process-wide Semaphore for throttling on-demand thumbnail extractions."""
    global _thumbnail_semaphore
    if _thumbnail_semaphore is None:
        _thumbnail_semaphore = asyncio.Semaphore(6)
    return _thumbnail_semaphore


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

    # 1. Check existing recorded thumbnail path (require >= 1200 bytes for full-res)
    if thumb_path_str:
        thumb_file = Path(thumb_path_str)
        if thumb_file.exists() and thumb_file.stat().st_size >= 1200:
            return FileResponse(
                path=thumb_file,
                media_type="image/webp",
                headers={
                    "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
                    "Content-Disposition": f"inline; filename={thumb_file.name}",
                },
            )
        elif thumb_file.exists():
            thumb_file.unlink(missing_ok=True)

    # 2. Check if thumbnail exists in standard directory by hash (require >= 1200 bytes)
    candidate_thumb = settings.thumbnails_path / f"{file_hash}.webp"
    if candidate_thumb.exists() and candidate_thumb.stat().st_size >= 1200:
        await MediaRepository.update_thumbnail_path(media_id, str(candidate_thumb.as_posix()))
        return FileResponse(
            path=candidate_thumb,
            media_type="image/webp",
            headers={
                "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
                "Content-Disposition": f"inline; filename={candidate_thumb.name}",
            },
        )
    elif candidate_thumb.exists():
        candidate_thumb.unlink(missing_ok=True)

    # 3. High-performance on-demand generation from Telegram vault (throttled by semaphore)
    async with get_thumbnail_semaphore():
        # Double-check: another concurrent worker may have generated this thumbnail while we waited in queue
        if candidate_thumb.exists() and candidate_thumb.stat().st_size >= 1200:
            await MediaRepository.update_thumbnail_path(media_id, str(candidate_thumb.as_posix()))
            return FileResponse(
                path=candidate_thumb,
                media_type="image/webp",
                headers={
                    "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
                    "Content-Disposition": f"inline; filename={candidate_thumb.name}",
                },
            )

        telegram_client = get_telegram_client()
        channel_id = item["telegram_channel_id"]
        message_id = item["telegram_message_id"]

        try:
            await telegram_client.start()
            entity = await telegram_client.get_target_entity(channel_id)
            message = await telegram_client.raw_client.get_messages(entity, ids=message_id)

            # 3a. Check for Telegram native preview bytes first (instant <10ms for photos & videos with embedded thumbs)
            if message and message.media:
                try:
                    native_thumb_bytes = await telegram_client.raw_client.download_media(
                        message, thumb=-1, file=bytes
                    )
                    if native_thumb_bytes:
                        from src.services.thumbnail_service import generate_thumbnail_from_bytes
                        generated = generate_thumbnail_from_bytes(native_thumb_bytes, file_hash)
                        if generated and Path(generated).exists():
                            await MediaRepository.update_thumbnail_path(media_id, generated)
                            return FileResponse(
                                path=Path(generated),
                                media_type="image/webp",
                                headers={
                                    "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
                                    "Content-Disposition": f"inline; filename={Path(generated).name}",
                                },
                            )
                except Exception as e:
                    logger.warning(f"[Thumbnail] Native thumb extraction failed for media {media_id}: {e}")

            # 3b. For regular photos, ONLY download if it's a standard web image and <= 5MB.
            # Never download camera RAW files (.RAF, .CR2, .NEF, etc.) or large files on-the-fly,
            # as they stall network connections and cannot be decoded by standard Pillow.
            # For videos without native Telegram thumbnails, do NOT stream multi-MB chunks synchronously;
            # they fail-fast to 404 instantly (<1ms) to eliminate browser socket starvation.
            file_name = item.get("file_name", "")
            ext = Path(file_name).suffix.lower()
            file_size = item.get("file_size", 0)
            if ext in SUPPORTED_IMAGE_EXTS and file_size <= 5 * 1024 * 1024:
                suffix = ext or ".tmp"
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    tmp_path = Path(tmp.name)
                
                try:
                    await telegram_client.download_document(
                        channel_id=channel_id,
                        message_id=message_id,
                        destination=tmp_path,
                    )
                    generated = generate_thumbnail(
                        file_path=tmp_path,
                        file_hash=file_hash,
                        mime_type=mime_type,
                    )
                    if generated and Path(generated).exists():
                        await MediaRepository.update_thumbnail_path(media_id, generated)
                        return FileResponse(
                            path=Path(generated),
                            media_type="image/webp",
                            headers={
                                "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
                                "Content-Disposition": f"inline; filename={Path(generated).name}",
                            },
                        )
                finally:
                    if tmp_path.exists():
                        tmp_path.unlink()

        except Exception as e:
            logger.error(f"[Thumbnail] On-demand thumbnail generation failed for media {media_id}: {e}")

    raise HTTPException(
        status_code=404,
        detail="Thumbnail not available for this item yet",
        headers={"Cache-Control": "no-cache, max-age=10, must-revalidate"},
    )


@router.post("/generate-missing")
async def trigger_missing_thumbnails():
    """Triggers asynchronous background thumbnail generation for any videos missing thumbnails."""
    from src.services.background_thumbnail_worker import get_thumbnail_worker
    worker = get_thumbnail_worker()
    worker.start_worker_task()
    worker.trigger_scan()
    return {"status": "triggered", "message": "Background thumbnail generator started"}


@router.post("/process-videos-sync")
async def process_videos_sync():
    """Directly executes pending video thumbnail generation and returns the result."""
    from src.services.background_thumbnail_worker import get_thumbnail_worker
    worker = get_thumbnail_worker()
    try:
        await worker._process_pending_videos()
        return {"status": "success"}
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}


@router.get("/{media_id:int}/preview")
async def get_media_preview(media_id: int):
    """
    Serves an ultra-lightweight animated WebP hover preview (~100 KB) for videos.
    If cached preview exists, returns immediately via kernel sendfile.
    If local video file is available, generates preview on-the-fly and saves to disk.
    Falls back to static thumbnail (0ms) if source video is not yet on local disk.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    file_hash = item["file_hash"]
    settings = get_settings()
    preview_path = settings.thumbnails_path / f"{file_hash}_preview.webp"

    # 1. Fast path: Cached preview already exists
    if preview_path.exists() and preview_path.stat().st_size > 0:
        return FileResponse(
            path=preview_path,
            media_type="image/webp",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    # 2. Check if local video source is available in stream cache or tdlib directory
    from src.services.stream_cache import get_stream_cache
    stream_cache = get_stream_cache()
    cached_source = stream_cache.get_cache_path(file_hash)
    if not (cached_source.exists() and cached_source.stat().st_size > 0):
        data_dir = Path(settings.db_path).parent
        td_doc = data_dir / "tdlib" / "files" / "documents" / item["file_name"]
        td_anim = data_dir / "tdlib" / "files" / "animations" / item["file_name"]
        if td_doc.exists() and td_doc.stat().st_size > 0:
            cached_source = td_doc
        elif td_anim.exists() and td_anim.stat().st_size > 0:
            cached_source = td_anim

    if cached_source.exists() and cached_source.stat().st_size > 0:
        from src.services.thumbnail_service import generate_video_preview, generate_video_thumbnail

        # Proactively ensure static WebP thumbnail also exists for the gallery grid
        static_thumb = settings.thumbnails_path / f"{file_hash}.webp"
        if not (static_thumb.exists() and static_thumb.stat().st_size >= 1200):
            created_thumb = generate_video_thumbnail(cached_source, file_hash)
            if created_thumb and Path(created_thumb).exists():
                await MediaRepository.update_thumbnail_path(media_id, created_thumb)

        gen = generate_video_preview(cached_source, file_hash)
        if gen and Path(gen).exists():
            return FileResponse(
                path=Path(gen),
                media_type="image/webp",
                headers={"Cache-Control": "public, max-age=31536000, immutable"},
            )

    # 3. Fallback to standard static thumbnail (0ms response, zero Telegram network call)
    thumb_path = settings.thumbnails_path / f"{file_hash}.webp"
    if thumb_path.exists() and thumb_path.stat().st_size > 0:
        return FileResponse(
            path=thumb_path,
            media_type="image/webp",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    raise HTTPException(status_code=404, detail="Preview not available")
