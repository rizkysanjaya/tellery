"""
=============================================================================
Module: src.services.background_thumbnail_worker
Purpose: Asynchronous background worker that generates high-resolution WebP thumbnails
         and extracts video metadata (width, height, duration) for videos lacking
         native Telegram previews. Utilizes ultra-fast sparse head+tail MTProto range
         chunk streaming (1.5MB head + 1.5MB tail), dropping download size from 100MB
         to 3MB for 30x faster frame 0 extraction without browser socket starvation.
Used by: src.api.app (lifespan startup), src.services.sync_service (post-sync trigger),
         src.api.routes.thumbnails (manual trigger endpoint)
Dependencies: asyncio, logging, pathlib, tempfile, cv2, src.config,
              src.database.connection, src.services.thumbnail_service,
              src.storage.telegram_client, src.services.stream_cache
Public Members: BackgroundThumbnailWorker, get_thumbnail_worker()
Side Effects: Downloads low-overhead sparse MTProto range chunks, writes WebP thumbnails
              to .thumbnails/, and updates SQLite media_items atomically.
=============================================================================
"""

import asyncio
import logging
from pathlib import Path
import tempfile
from typing import Optional
import os
os.environ.setdefault("OPENCV_FFMPEG_LOGLEVEL", "-8")
os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")

from src.config import get_settings
from src.database.connection import get_db_connection
from src.services.thumbnail_service import generate_video_thumbnail
from src.storage.telegram_client import get_telegram_client
from src.services.stream_cache import get_stream_cache

logger = logging.getLogger(__name__)


class BackgroundThumbnailWorker:
    """
    Background worker that monitors and generates missing video thumbnails
    in a decoupled, non-blocking queue.
    """

    def __init__(self) -> None:
        self._is_running = False
        self._task: Optional[asyncio.Task] = None
        self._queue_trigger = asyncio.Event()

    def start_worker_task(self) -> None:
        """Starts the background worker task if not already running."""
        if self._task is None or self._task.done():
            self._is_running = True
            self._task = asyncio.create_task(self._worker_loop())
            logger.info("[ThumbnailWorker] Background video thumbnail worker task started.")

    def trigger_scan(self) -> None:
        """Signals the worker to scan for any newly added videos lacking thumbnails."""
        self._queue_trigger.set()

    async def _worker_loop(self) -> None:
        """Main loop that continuously checks and processes videos needing thumbnails."""
        # Initial scan on startup after 3s grace period for server initialization
        await asyncio.sleep(3.0)
        self._queue_trigger.set()

        while self._is_running:
            try:
                # Wait for trigger or timeout every 60 seconds
                try:
                    await asyncio.wait_for(self._queue_trigger.wait(), timeout=60.0)
                except asyncio.TimeoutError:
                    pass
                self._queue_trigger.clear()

                await self._process_pending_videos()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[ThumbnailWorker] Unexpected error in worker loop: {e}", exc_info=True)
                await asyncio.sleep(5.0)

    async def _process_pending_videos(self) -> None:
        """Fetches and generates thumbnails for all active videos missing a thumbnail."""
        settings = get_settings()
        stream_cache = get_stream_cache()
        telegram_client = get_telegram_client()

        async with get_db_connection() as conn:
            async with conn.execute(
                """
                SELECT id, file_hash, file_name, file_size, mime_type, telegram_channel_id, telegram_message_id, width, height, duration_seconds
                FROM media_items
                WHERE is_deleted = 0
                  AND (thumbnail_path IS NULL OR thumbnail_path = '')
                  AND mime_type LIKE 'video/%'
                ORDER BY id DESC
                """
            ) as cursor:
                rows = await cursor.fetchall()

        if not rows:
            return

        logger.info(f"[ThumbnailWorker] 🎬 Processing {len(rows)} videos without thumbnails in background...")

        for idx, row in enumerate(rows, 1):
            media_id = row["id"]
            file_hash = row["file_hash"]
            file_name = row["file_name"]
            channel_id = row["telegram_channel_id"]
            message_id = row["telegram_message_id"]

            try:
                # 1. Check if thumbnail already exists on disk
                thumb_file = settings.thumbnails_path / f"{file_hash}.webp"
                if thumb_file.exists() and thumb_file.stat().st_size >= 1200:
                    async with get_db_connection() as conn:
                        await conn.execute(
                            "UPDATE media_items SET thumbnail_path = ? WHERE id = ?",
                            (str(thumb_file.as_posix()), media_id),
                        )
                        await conn.commit()
                    continue

                # 2. Check if local video source is already in stream cache
                cached_source = stream_cache.get_cache_path(file_hash)
                video_file = None
                is_sparse = False

                if cached_source.exists() and cached_source.stat().st_size >= row["file_size"]:
                    video_file = cached_source
                else:
                    # High-speed sparse head+tail range download:
                    # Downloads 1.5MB from head (containing ftyp & frame 0)
                    # and 1.5MB from tail (containing moov atom for non-faststart videos).
                    # Drops network payload from 100MB to ~3MB, extracting frame 0 in 1-2s!
                    file_size = row["file_size"]
                    chunk_size = 512 * 1024
                    head_parts = 3  # 1.5MB

                    entity = await telegram_client.get_target_entity(channel_id)
                    msg = await telegram_client.raw_client.get_messages(entity, ids=message_id)

                    if msg and msg.media:
                        try:
                            # Fetch head
                            head_bytes = bytearray()
                            async for chunk in telegram_client.raw_client.iter_download(
                                msg.media, offset=0, chunk_size=chunk_size, request_size=chunk_size
                            ):
                                head_bytes.extend(chunk)
                                if len(head_bytes) >= head_parts * chunk_size or len(head_bytes) >= file_size:
                                    break

                            # Fetch tail if file is larger than 3MB
                            tail_bytes = bytearray()
                            tail_offset = 0
                            if file_size > head_parts * 2 * chunk_size:
                                tail_offset = max(0, ((file_size - head_parts * chunk_size) // chunk_size) * chunk_size)
                                async for chunk in telegram_client.raw_client.iter_download(
                                    msg.media, offset=tail_offset, chunk_size=chunk_size, request_size=chunk_size
                                ):
                                    tail_bytes.extend(chunk)

                            temp_dir = Path("data/cache/temp_sparse")
                            temp_dir.mkdir(parents=True, exist_ok=True)
                            sparse_file = temp_dir / f"{file_hash}_sparse.mp4"
                            with open(sparse_file, "wb") as f:
                                f.write(head_bytes)
                                if tail_bytes:
                                    f.seek(tail_offset)
                                    f.write(tail_bytes)
                                f.truncate(file_size)

                            video_file = sparse_file
                            is_sparse = True
                        except Exception as dl_err:
                            logger.warning(f"[ThumbnailWorker] Sparse range download note for '{file_name}': {dl_err}")

                # If sparse failed or not available, fallback to full download
                if not video_file or not video_file.exists():
                    video_file = cached_source
                    cached_source.parent.mkdir(parents=True, exist_ok=True)
                    logger.info(
                        f"[ThumbnailWorker] ⏳ [{idx}/{len(rows)}] Full downloading '{file_name}' "
                        f"({row['file_size'] // 1024 // 1024} MB)..."
                    )
                    await telegram_client.download_document(
                        channel_id=channel_id,
                        message_id=message_id,
                        destination=video_file,
                    )
                    is_sparse = False

                try:
                    # 3. Generate high-quality WebP thumbnail
                    generated_thumb = generate_video_thumbnail(video_file, file_hash)
                    if not (generated_thumb and Path(generated_thumb).exists()):
                        logger.warning(f"[ThumbnailWorker] Frame extraction returned None for '{file_name}' (ID: {media_id})")
                        continue

                    # 4. Extract technical metadata (width, height, duration) via OpenCV if missing
                    width = row["width"]
                    height = row["height"]
                    duration_seconds = row["duration_seconds"]

                    if not (width and height and duration_seconds):
                        cap = None
                        try:
                            cap = cv2.VideoCapture(str(video_file))
                            if cap.isOpened():
                                if not width:
                                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                                if not height:
                                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                                if not duration_seconds:
                                    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
                                    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                                    if fps > 0 and total_frames > 0:
                                        duration_seconds = round(float(total_frames / fps), 2)
                        except Exception as meta_err:
                            logger.warning(f"[ThumbnailWorker] Could not extract video specs for '{file_name}': {meta_err}")
                        finally:
                            if cap is not None:
                                cap.release()

                    # 5. Update SQLite record atomically
                    async with get_db_connection() as conn:
                        await conn.execute(
                            """
                            UPDATE media_items
                            SET thumbnail_path = ?,
                                width = COALESCE(?, width),
                                height = COALESCE(?, height),
                                duration_seconds = COALESCE(?, duration_seconds)
                            WHERE id = ?
                            """,
                            (generated_thumb, width or None, height or None, duration_seconds or None, media_id),
                        )
                        await conn.commit()

                    logger.info(
                        f"[ThumbnailWorker] ✅ [{idx}/{len(rows)}] Generated thumbnail for '{file_name}' "
                        f"({width}x{height}, {duration_seconds}s)"
                    )
                finally:
                    if is_sparse and video_file and video_file.exists():
                        try:
                            video_file.unlink()
                        except Exception:
                            pass

                # Micro-pause to yield execution and keep network/CPU free for user interactions
                await asyncio.sleep(0.2)

            except Exception as item_err:
                logger.error(f"[ThumbnailWorker] Failed processing video ID {media_id} ('{file_name}'): {item_err}")
                await asyncio.sleep(1.0)


_worker_instance: Optional[BackgroundThumbnailWorker] = None


def get_thumbnail_worker() -> BackgroundThumbnailWorker:
    """Returns singleton instance of BackgroundThumbnailWorker."""
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = BackgroundThumbnailWorker()
    return _worker_instance