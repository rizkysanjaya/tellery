"""
=============================================================================
Module: src.api.routes.stream
Purpose: High-performance HTTP 206 Partial Content video/media streaming route.
         Utilizes StreamCacheManager for zero-latency local seekable playback
         and RFC 5987 Unicode Content-Disposition headers.
Used by: HTML5 <video>, <audio>, Lightbox full-res media viewers.
Dependencies: fastapi, urllib.parse, src.database.repository, src.services.stream_cache, typing
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
    Backed by local disk cache manager to eliminate network buffering.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    file_size = item["file_size"]
    mime_type = item["mime_type"] or "application/octet-stream"
    channel_id = item["telegram_channel_id"]
    message_id = item["telegram_message_id"]
    file_hash = item["file_hash"]
    content_disp = _encode_content_disposition(item["file_name"], disposition="inline")

    cache_manager = get_stream_cache()

    try:
        cache_path = await cache_manager.ensure_cached(
            message_id=message_id,
            channel_id=channel_id,
            file_hash=file_hash,
            file_size=file_size,
        )
    except Exception as e:
        print(f"[Stream] Failed to cache stream for media {media_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve media from storage vault")

    # Case 1: No Range header (Full document request)
    if not range_header:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": mime_type,
            "Content-Disposition": content_disp,
        }
        return StreamingResponse(
            cache_manager.stream_file_range(
                file_path=cache_path,
                start=0,
                end=file_size - 1,
            ),
            status_code=status.HTTP_200_OK,
            headers=headers,
            media_type=mime_type,
        )

    # Case 2: HTTP Range Request (Partial Content)
    match = RANGE_HEADER_REGEX.match(range_header.strip())
    if not match:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Invalid Range header format. Expected 'bytes=start-end'",
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    raw_start, raw_end = match.groups()
    start = int(raw_start)
    end = int(raw_end) if raw_end else file_size - 1

    # Validate range limits
    if start >= file_size or end >= file_size or start > end:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Requested range out of bounds",
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    content_length = (end - start) + 1
    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": mime_type,
        "Content-Disposition": content_disp,
    }

    return StreamingResponse(
        cache_manager.stream_file_range(
            file_path=cache_path,
            start=start,
            end=end,
        ),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=mime_type,
    )
