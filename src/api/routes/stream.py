"""
=============================================================================
Module: src.api.routes.stream
Purpose: High-performance HTTP 206 Partial Content video/media streaming route.
         Utilizes StreamCacheManager with progressive live chunk streaming,
         automated on-the-fly H.264 web transcoding for HEVC/ProRes videos,
         and RFC 5987 Unicode Content-Disposition headers.
Used by: HTML5 <video>, <audio>, Lightbox full-res media viewers.
Dependencies: fastapi, urllib.parse, src.database.repository, src.services.stream_cache,
              src.services.transcoder_service, typing
Public Members: router, stream_media()
Side Effects: Streams byte chunks across HTTP response, caches hot stream files in data/cache/.
=============================================================================
"""

import re
import urllib.parse
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from src.database.repository import MediaRepository
from src.services.stream_cache import get_stream_cache
from src.services.transcoder_service import ensure_web_stream_ready

router = APIRouter(prefix="/api/media", tags=["Media Streaming"])

RANGE_HEADER_REGEX = re.compile(r"^bytes=(\d+)-(\d*)$")


def _encode_content_disposition(file_name: str, disposition: str = "inline") -> str:
    """
    Encodes Content-Disposition header conforming to RFC 5987 / RFC 6266.
    Ensures non-ASCII / Unicode filenames (Korean, Japanese, emojis, accents)
    never crash the ASGI server with UnicodeEncodeError.
    """
    ascii_safe_name = file_name.encode("ascii", "ignore").decode("ascii").strip()
    if not ascii_safe_name:
        ascii_safe_name = "media_file"
    ascii_safe_name = ascii_safe_name.replace('"', "").replace("\\", "")

    encoded_utf8 = urllib.parse.quote(file_name, encoding="utf-8")
    return f'{disposition}; filename="{ascii_safe_name}"; filename*=UTF-8\'\'{encoded_utf8}'


@router.get("/{media_id:int}/stream")
async def stream_media(
    media_id: int,
    request: Request,
    range_header: Optional[str] = Header(None, alias="Range"),
):
    """
    Streams media content with lightning-fast HTTP 206 Partial Content Range seeking.
    Backed by local progressive disk cache manager and automatic H.264 web transcoding.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    raw_file_size = item["file_size"]
    mime_type = item["mime_type"] or "application/octet-stream"
    channel_id = item["telegram_channel_id"]
    message_id = item["telegram_message_id"]
    file_hash = item["file_hash"]
    content_disp = _encode_content_disposition(item["file_name"], disposition="inline")

    cache_manager = get_stream_cache()

    try:
        cache_path = await cache_manager.ensure_cached_or_downloading(
            message_id=message_id,
            channel_id=channel_id,
            file_hash=file_hash,
            file_size=raw_file_size,
        )
    except Exception as e:
        print(f"[Stream] Failed to cache stream for media {media_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve media from storage vault")

    # If this is a video and the source is cached on disk, ensure it is web-compatible (H.264)
    target_stream_path = cache_path
    stream_file_size = raw_file_size
    target_mime_type = mime_type
    target_file_hash = file_hash

    if mime_type.startswith("video/") and cache_path.exists():
        web_path = ensure_web_stream_ready(cache_path, file_hash)
        if web_path != cache_path and web_path.exists():
            target_stream_path = web_path
            stream_file_size = web_path.stat().st_size
            target_mime_type = "video/mp4"
            target_file_hash = f"{file_hash}_web"

    # Case 1: No Range header (Full document request)
    if not range_header:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(stream_file_size),
            "Content-Type": target_mime_type,
            "Content-Disposition": content_disp,
        }
        return StreamingResponse(
            cache_manager.stream_file_range(
                file_path=target_stream_path,
                file_hash=target_file_hash,
                start=0,
                end=stream_file_size - 1,
            ),
            status_code=status.HTTP_200_OK,
            headers=headers,
            media_type=target_mime_type,
        )

    # Case 2: HTTP Range Request (Partial Content)
    match = RANGE_HEADER_REGEX.match(range_header.strip())
    if not match:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Invalid Range header format. Expected 'bytes=start-end'",
            headers={"Content-Range": f"bytes */{stream_file_size}"},
        )

    raw_start, raw_end = match.groups()
    start = int(raw_start)
    end = int(raw_end) if raw_end else stream_file_size - 1

    # Validate range limits
    if start >= stream_file_size or end >= stream_file_size or start > end:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Requested range out of bounds",
            headers={"Content-Range": f"bytes */{stream_file_size}"},
        )

    content_length = (end - start) + 1
    headers = {
        "Content-Range": f"bytes {start}-{end}/{stream_file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": target_mime_type,
        "Content-Disposition": content_disp,
    }

    return StreamingResponse(
        cache_manager.stream_file_range(
            file_path=target_stream_path,
            file_hash=target_file_hash,
            start=start,
            end=end,
        ),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=target_mime_type,
    )
