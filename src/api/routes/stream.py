"""
=============================================================================
Module: src.api.routes.stream
Purpose: HTTP 206 Partial Content video/audio/photo streaming bridge directly from Telegram MTProto
         with RFC 5987 Unicode Content-Disposition headers.
Used by: HTML5 <video>, <audio>, Lightbox full-res media viewers.
Dependencies: fastapi, urllib.parse, src.database.repository, src.storage.telegram_client, typing
Public Members: router, stream_media_range
Side Effects: Streams MTProto chunk data across HTTP response.
=============================================================================
"""

import re
import urllib.parse
from typing import AsyncIterator, Optional, Union
from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import Response, StreamingResponse
from src.database.repository import MediaRepository
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client

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
    # Remove double quotes and backslashes from ascii fallback
    ascii_safe_name = ascii_safe_name.replace('"', "").replace("\\", "")
    
    encoded_utf8 = urllib.parse.quote(file_name, encoding="utf-8")
    return f'{disposition}; filename="{ascii_safe_name}"; filename*=UTF-8\'\'{encoded_utf8}'


async def stream_media_range(
    telegram_client: TelegramStorageClient,
    message_id: int,
    channel_id: Union[int, str],
    start: int,
    end: int,
    chunk_size: int = 128 * 1024,
) -> AsyncIterator[bytes]:
    """
    Streams exact [start, end] byte range directly from Telegram MTProto chunks.
    Aligns MTProto offset to chunk boundaries and accurately slices byte streams.
    """
    aligned_offset = (start // chunk_size) * chunk_size
    bytes_to_skip = start - aligned_offset
    total_requested_bytes = (end - start) + 1
    bytes_sent = 0

    async for chunk in telegram_client.iter_document_chunks(
        message_id=message_id,
        channel_id=channel_id,
        offset=aligned_offset,
        chunk_size=chunk_size,
    ):
        if not chunk:
            break

        # Skip leading unaligned bytes from first chunk
        if bytes_to_skip > 0:
            if len(chunk) <= bytes_to_skip:
                bytes_to_skip -= len(chunk)
                continue
            else:
                chunk = chunk[bytes_to_skip:]
                bytes_to_skip = 0

        # Trim trailing bytes if exceeding requested range
        needed = total_requested_bytes - bytes_sent
        if len(chunk) > needed:
            chunk = chunk[:needed]

        yield chunk
        bytes_sent += len(chunk)

        if bytes_sent >= total_requested_bytes:
            break


@router.get("/{media_id:int}/stream")
async def stream_media(
    media_id: int,
    request: Request,
    range_header: Optional[str] = Header(None, alias="Range"),
):
    """
    Streams full or partial media content with HTTP 206 Range seeking support.
    Enables instant seeking in web video players without downloading entire files.
    """
    item = await MediaRepository.get_by_id(media_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")

    file_size = item["file_size"]
    mime_type = item["mime_type"] or "application/octet-stream"
    channel_id = item["telegram_channel_id"]
    message_id = item["telegram_message_id"]
    content_disp = _encode_content_disposition(item["file_name"], disposition="inline")

    telegram_client = get_telegram_client()

    # Case 1: No Range header (Full document request)
    if not range_header:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": mime_type,
            "Content-Disposition": content_disp,
        }
        return StreamingResponse(
            stream_media_range(
                telegram_client=telegram_client,
                message_id=message_id,
                channel_id=channel_id,
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
        stream_media_range(
            telegram_client=telegram_client,
            message_id=message_id,
            channel_id=channel_id,
            start=start,
            end=end,
        ),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=mime_type,
    )
