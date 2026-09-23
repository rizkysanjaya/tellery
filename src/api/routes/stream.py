"""
=============================================================================
Module: src.api.routes.stream
Purpose: High-performance HTTP 206 Partial Content video/media streaming route.
         Utilizes StreamCacheManager with progressive live chunk streaming,
         fast FileResponse for cached media, automated on-the-fly H.264 web
         transcoding for HEVC/ProRes videos, and RFC 5987 Unicode Content-Disposition headers.
Used by: HTML5 <video>, <audio>, Lightbox full-res media viewers, GIF preview stream.
Dependencies: fastapi, urllib.parse, src.database.repository, src.services.stream_cache,
              src.services.transcoder_service, typing
Public Members: router, stream_media()
Side Effects: Streams byte chunks across HTTP response, caches hot stream files in data/cache/.
=============================================================================
"""

import re
import urllib.parse
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from src.database.repository import MediaRepository
from src.services.stream_cache import get_stream_cache
from src.services.transcoder_service import ensure_web_stream_ready

router = APIRouter(prefix="/api/media", tags=["Media Streaming"])

RANGE_HEADER_REGEX = re.compile(r"^bytes=(?:(\d+)-(\d*)|-(\d+))$")


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
    preview: bool = Query(False, description="Lightweight on-demand stream for gallery hover previews"),
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
    cache_path = cache_manager.get_cache_path(file_hash)

    target_stream_path = cache_path
    stream_file_size = raw_file_size
    target_mime_type = mime_type
    target_file_hash = file_hash

    # Check if a web-compatible transcoded version already exists in cache
    web_cached = cache_manager.cache_dir / f"{file_hash}_web.mp4"
    if web_cached.exists() and web_cached.stat().st_size > 0:
        target_stream_path = web_cached
        stream_file_size = web_cached.stat().st_size
        target_mime_type = "video/mp4"
        target_file_hash = f"{file_hash}_web"
    elif mime_type.startswith("video/") and cache_path.exists() and cache_path.stat().st_size == raw_file_size:
        web_path = ensure_web_stream_ready(cache_path, file_hash)
        if web_path != cache_path and web_path.exists():
            target_stream_path = web_path
            stream_file_size = web_path.stat().st_size
            target_mime_type = "video/mp4"
            target_file_hash = f"{file_hash}_web"

    # Defensive MIME correction: Verify container magic bytes if cached file exists
    if target_stream_path.exists() and target_stream_path.stat().st_size >= 12:
        try:
            with open(target_stream_path, "rb") as f_head:
                head_bytes = f_head.read(12)
                if len(head_bytes) >= 8 and head_bytes[4:8] == b"ftyp":
                    target_mime_type = "video/mp4"
                elif head_bytes.startswith(b"GIF87a") or head_bytes.startswith(b"GIF89a"):
                    target_mime_type = "image/gif"
        except Exception:
            pass

    # 1. Proactively check TDLib local download cache if file is not in data/cache
    if not (target_stream_path.exists() and target_stream_path.stat().st_size == stream_file_size):
        try:
            from src.storage.tdlib_client import get_tdlib_client
            td_client = get_tdlib_client()
            if td_client.auth_state == "authorizationStateReady" and message_id and channel_id:
                cid_raw = str(channel_id).lstrip("-").lstrip("100")
                chat_id = int(f"-100{cid_raw}")
                td_msg_id = message_id * (1 << 20)
                msg = await td_client.send_request({
                    "@type": "getMessage",
                    "chat_id": chat_id,
                    "message_id": td_msg_id,
                })
                content = msg.get("content", {})
                file_info = (
                    content.get("document", {}).get("document")
                    or content.get("video", {}).get("video")
                    or content.get("animation", {}).get("animation")
                )
                if file_info and file_info.get("id"):
                    f_stat = await td_client.send_request({"@type": "getFile", "file_id": file_info["id"]})
                    local = f_stat.get("local", {})
                    local_path = local.get("path")
                    if local_path and Path(local_path).exists():
                        lp = Path(local_path)
                        if lp.stat().st_size == stream_file_size:
                            import shutil
                            try:
                                shutil.copyfile(lp, target_stream_path)
                                cache_manager.touch_cache(target_stream_path)
                                cache_manager.prune_lru_cache()
                            except Exception:
                                target_stream_path = lp
        except Exception:
            pass

    # 2. Instant SSD Fast Path: When file is fully cached on disk, serve via FileResponse
    # Starlette's FileResponse natively provides kernel sendfile, precise Content-Length,
    # and RFC 7233 byte-range seeking for both Range and non-Range requests in 0ms.
    if target_stream_path.exists() and target_stream_path.stat().st_size == stream_file_size:
        return FileResponse(
            path=target_stream_path,
            media_type=target_mime_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Disposition": content_disp,
            },
        )

    # 3. Dynamic Progressive Streaming for uncached files
    if not range_header:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Type": target_mime_type,
            "Content-Disposition": content_disp,
        }
        return StreamingResponse(
            cache_manager.stream_file_range(
                file_path=target_stream_path,
                file_hash=target_file_hash,
                start=0,
                end=stream_file_size - 1,
                expected_total_size=stream_file_size,
                message_id=message_id,
                channel_id=channel_id,
                is_preview=preview,
            ),
            status_code=status.HTTP_200_OK,
            headers=headers,
            media_type=target_mime_type,
        )

    # HTTP Range Request for uncached file
    match = RANGE_HEADER_REGEX.match(range_header.strip())
    if not match:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Invalid Range header format. Expected 'bytes=start-end'",
            headers={"Content-Range": f"bytes */{stream_file_size}"},
        )

    raw_start, raw_end, suffix = match.groups()
    if suffix is not None:
        suffix_len = int(suffix)
        if suffix_len <= 0:
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail="Invalid suffix range length",
                headers={"Content-Range": f"bytes */{stream_file_size}"},
            )
        start = max(0, stream_file_size - suffix_len)
        end = stream_file_size - 1
    else:
        start = int(raw_start)
        end = int(raw_end) if raw_end else stream_file_size - 1

    if start >= stream_file_size or end >= stream_file_size or start > end:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Requested range out of bounds",
            headers={"Content-Range": f"bytes */{stream_file_size}"},
        )

    # For uncached files, window open-ended ranges only for hover previews to conserve bandwidth.
    # Full player requests stream continuously to EOF to prevent buffer starvation on high-bitrate media.
    if not raw_end and preview:
        max_chunk_window = 4 * 1024 * 1024  # 4 MB for hover previews
        end = min(start + max_chunk_window - 1, stream_file_size - 1)

    content_length = (end - start) + 1
    headers = {
        "Content-Range": f"bytes {start}-{end}/{stream_file_size}",
        "Content-Length": str(content_length),
        "Accept-Ranges": "bytes",
        "Content-Type": target_mime_type,
        "Content-Disposition": content_disp,
    }

    return StreamingResponse(
        cache_manager.stream_file_range(
            file_path=target_stream_path,
            file_hash=target_file_hash,
            start=start,
            end=end,
            expected_total_size=stream_file_size,
            message_id=message_id,
            channel_id=channel_id,
            is_preview=preview,
        ),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=target_mime_type,
    )
