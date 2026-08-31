"""
=============================================================================
Module: src.api.routes.thumbnails
Purpose: High-performance WebP thumbnail & animated WebP video preview delivery
         endpoints with ultra-lightweight on-demand extraction preventing full-file download locks.
Used by: Gallery UI Grid, Lightbox previews, Folder Cover Cards, Video Hover Previews.
Dependencies: fastapi, pathlib, tempfile, src.database.repository, src.config,
              src.services.thumbnail_service, src.storage.telegram_client
Public Members: router, get_media_thumbnail(), get_media_preview()
Side Effects: Serves cached WebP files from disk; writes extracted WebP to disk
              and updates SQLite thumbnail_path for instant sub-20ms subsequent reads.
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

    # 3. High-performance on-demand generation from Telegram vault
    telegram_client = get_telegram_client()
    channel_id = item["telegram_channel_id"]
    message_id = item["telegram_message_id"]

    try:
        await telegram_client.start()
        entity = await telegram_client.get_target_entity(channel_id)
        message = await telegram_client.raw_client.get_messages(entity, ids=message_id)

        # 3a. Check for Telegram native preview bytes first (instant <10ms)
        if message and message.media:
            try:
                native_thumb_bytes = await telegram_client.raw_client.download_media(
                    message.media, thumb=-1, file=bytes
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
                                "Cache-Control": "public, max-age=31536000, immutable",
                                "Content-Disposition": f"inline; filename={Path(generated).name}",
                            },
                        )
            except Exception as e:
                print(f"[Thumbnail] Native thumb extraction failed for media {media_id}: {e}")

        # 3b. For video items, stream only the first 3MB header to extract frame 0 (never download full 800MB video)
        if mime_type.startswith("video/"):
            suffix = Path(item["file_name"]).suffix or ".mp4"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp_path = Path(tmp.name)
            
            try:
                buffer = bytearray()
                async for chunk in telegram_client.iter_document_chunks(
                    channel_id=channel_id,
                    message_id=message_id,
                    offset=0,
                    limit=3 * 1024 * 1024,
                ):
                    buffer.extend(chunk)
                    if len(buffer) >= 3 * 1024 * 1024:
                        break
                
                tmp_path.write_bytes(buffer)
                from src.services.thumbnail_service import generate_video_thumbnail
                generated = generate_video_thumbnail(tmp_path, file_hash)
                if generated and Path(generated).exists():
                    await MediaRepository.update_thumbnail_path(media_id, generated)
                    return FileResponse(
                        path=Path(generated),
                        media_type="image/webp",
                        headers={
                            "Cache-Control": "public, max-age=31536000, immutable",
                            "Content-Disposition": f"inline; filename={Path(generated).name}",
                        },
                    )
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()

        # 3c. For regular photos < 20MB, download and generate
        file_size = item.get("file_size", 0)
        if file_size < 20 * 1024 * 1024:
            suffix = Path(item["file_name"]).suffix or ".tmp"
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
                            "Cache-Control": "public, max-age=31536000, immutable",
                            "Content-Disposition": f"inline; filename={Path(generated).name}",
                        },
                    )
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()

    except Exception as e:
        print(f"[Thumbnail] On-demand thumbnail generation failed for media {media_id}: {e}")

    raise HTTPException(status_code=404, detail="Thumbnail not available for this item")


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
        td_doc = settings.data_dir / "tdlib" / "files" / "documents" / item["file_name"]
        td_anim = settings.data_dir / "tdlib" / "files" / "animations" / item["file_name"]
        if td_doc.exists() and td_doc.stat().st_size > 0:
            cached_source = td_doc
        elif td_anim.exists() and td_anim.stat().st_size > 0:
            cached_source = td_anim

    if cached_source.exists() and cached_source.stat().st_size > 0:
        from src.services.thumbnail_service import generate_video_preview
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
