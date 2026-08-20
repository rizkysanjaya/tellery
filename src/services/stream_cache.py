"""
=============================================================================
Module: src.services.stream_cache
Purpose: High-performance progressive streaming cache manager for instant seekable media playback.
         Eliminates Telegram MTProto network latency by caching streamed media locally,
         supporting progressive chunk-by-chunk playback without waiting for full download,
         and deduplicating in-flight network fetches.
Used by: src.api.routes.stream, src.services.archive_service
Dependencies: asyncio, pathlib, src.config, src.storage.telegram_client
Public Members: StreamCacheManager, get_stream_cache()
Side Effects: Reads/writes cached binary media files in data/cache/.
=============================================================================
"""

import asyncio
from pathlib import Path
from typing import AsyncIterator, Dict, Optional, Union
from src.config import get_settings
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client


class StreamCacheManager:
    """
    Manages progressive local disk caching for media streams to provide 0ms latency video playback.
    Coalesces concurrent range requests for the same media into a single MTProto download.
    """

    def __init__(self, cache_dir: Optional[Union[str, Path]] = None) -> None:
        self.cache_dir = Path(cache_dir or "data/cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._inflight_downloads: Dict[str, asyncio.Task] = {}
        self._progress_events: Dict[str, asyncio.Event] = {}
        self._bytes_downloaded: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    def get_cache_path(self, file_hash: str) -> Path:
        """Returns the local cache file path for a given SHA-256 file hash."""
        return self.cache_dir / f"{file_hash}.bin"

    def is_cached_and_complete(self, file_hash: str, expected_size: int) -> bool:
        """Checks if a file is already fully cached on local disk."""
        target = self.get_cache_path(file_hash)
        return target.exists() and target.stat().st_size == expected_size

    async def ensure_cached_or_downloading(
        self,
        message_id: int,
        channel_id: Union[int, str],
        file_hash: str,
        file_size: int,
        telegram_client: Optional[TelegramStorageClient] = None,
    ) -> Path:
        """
        Ensures the media file is either fully cached or actively downloading.
        Returns the cache path immediately without blocking on full download completion.
        """
        cache_path = self.get_cache_path(file_hash)

        # 1. Cache HIT (Full file on disk)
        if cache_path.exists() and cache_path.stat().st_size == file_size:
            return cache_path

        # 2. Initiate or attach to active in-flight progressive download
        async with self._lock:
            if file_hash not in self._inflight_downloads:
                client = telegram_client or get_telegram_client()
                event = asyncio.Event()
                self._progress_events[file_hash] = event
                self._bytes_downloaded[file_hash] = 0

                download_task = asyncio.create_task(
                    self._do_progressive_download(
                        client, message_id, channel_id, cache_path, file_hash, file_size
                    )
                )
                self._inflight_downloads[file_hash] = download_task

        return cache_path

    def trigger_background_caching(
        self,
        message_id: int,
        channel_id: Union[int, str],
        file_hash: str,
        file_size: int,
    ) -> None:
        """
        Spawns background parallel download task if not already cached or downloading.
        Runs completely non-blocking in the background without halting live stream responses.
        """
        cache_path = self.get_cache_path(file_hash)
        if cache_path.exists() and cache_path.stat().st_size == file_size:
            return

        if file_hash not in self._inflight_downloads:
            task = asyncio.create_task(
                self._do_parallel_download(
                    message_id, channel_id, cache_path, file_hash, file_size
                )
            )
            self._inflight_downloads[file_hash] = task

    async def _do_parallel_download(
        self,
        message_id: int,
        channel_id: Union[int, str],
        target_path: Path,
        file_hash: str,
        expected_size: int,
        workers: int = 4,
        chunk_size: int = 1024 * 1024,
    ) -> None:
        """
        High-throughput multi-part parallel background downloader.
        Downloads in 1MB chunk slices across concurrent MTProto workers into local NVMe disk.
        """
        temp_path = self.cache_dir / f"{file_hash}.part"
        client = get_telegram_client()
        try:
            await client.start()
            entity = await client.get_target_entity(channel_id)
            message = await client._client.get_messages(entity, ids=message_id)
            if not message or not message.media:
                return

            # Pre-allocate sparse file if not exists
            if not temp_path.exists() or temp_path.stat().st_size != expected_size:
                with open(temp_path, "wb") as f:
                    f.truncate(expected_size)

            # Build chunk queue
            queue = asyncio.Queue()
            for offset in range(0, expected_size, chunk_size):
                length = min(chunk_size, expected_size - offset)
                queue.put_nowait((offset, length))

            file_lock = asyncio.Lock()

            async def worker():
                while not queue.empty():
                    try:
                        offset, length = queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break

                    try:
                        async for chunk in client._client.iter_download(
                            message.media,
                            offset=offset,
                            chunk_size=length,
                            request_size=length,
                        ):
                            if chunk:
                                async with file_lock:
                                    with open(temp_path, "r+b") as f:
                                        f.seek(offset)
                                        f.write(chunk)
                            break
                    except Exception:
                        # Brief backoff before retry
                        await asyncio.sleep(0.5)
                        queue.put_nowait((offset, length))
                    finally:
                        queue.task_done()

            # Launch parallel download workers
            worker_tasks = [asyncio.create_task(worker()) for _ in range(workers)]
            await asyncio.gather(*worker_tasks, return_exceptions=True)

            # Atomic swap to complete cache file upon 100% download
            if temp_path.exists() and temp_path.stat().st_size == expected_size:
                temp_path.replace(target_path)
                print(f"[StreamCache] Fully cached media {file_hash} ({expected_size} bytes)")
        except Exception as e:
            print(f"[StreamCache] Background caching error for {file_hash}: {e}")
        finally:
            async with self._lock:
                self._inflight_downloads.pop(file_hash, None)

    async def stream_file_range(
        self,
        file_path: Path,
        file_hash: str,
        start: int,
        end: int,
        message_id: Optional[int] = None,
        channel_id: Optional[Union[int, str]] = None,
        chunk_size: int = 512 * 1024,
    ) -> AsyncIterator[bytes]:
        """
        Progressively streams a byte slice [start, end] from disk cache if available,
        or falls back to direct MTProto chunk seeking for instant response on forward seeks / moov headers.
        """
        bytes_to_send = (end - start) + 1
        bytes_sent = 0
        part_path = self.cache_dir / f"{file_hash}.part"

        # Determine which path to open (completed cache file or active .part file)
        actual_path = file_path if file_path.exists() else part_path

        # 1. Fast path: if start is already available on disk, stream directly from disk
        if actual_path.exists() and actual_path.stat().st_size > start:
            with open(actual_path, "rb") as f:
                f.seek(start)
                while bytes_sent < bytes_to_send:
                    current_file_size = actual_path.stat().st_size
                    available_bytes = current_file_size - (start + bytes_sent)

                    if available_bytes <= 0:
                        if file_hash in self._inflight_downloads:
                            await asyncio.sleep(0.05)
                            continue
                        else:
                            break

                    read_len = min(chunk_size, bytes_to_send - bytes_sent, available_bytes)
                    data = f.read(read_len)
                    if not data:
                        if file_hash in self._inflight_downloads:
                            await asyncio.sleep(0.05)
                            continue
                        break

                    yield data
                    bytes_sent += len(data)
                    await asyncio.sleep(0)
            return

        # 2. Instant seek path: if start is far ahead of current disk cache and Telegram info is given,
        # stream on-demand directly from Telegram MTProto without blocking on sequential download!
        if message_id is not None and channel_id is not None:
            client = get_telegram_client()
            async for chunk in client.iter_document_chunks(
                message_id=message_id,
                channel_id=channel_id,
                offset=start,
                limit=bytes_to_send,
                chunk_size=chunk_size,
            ):
                yield chunk
            return

        # 3. Fallback: wait briefly on in-flight sequential download
        wait_cycles = 0
        while not actual_path.exists() or actual_path.stat().st_size <= start:
            if file_path.exists():
                actual_path = file_path
                break
            if file_hash not in self._inflight_downloads and not actual_path.exists():
                break
            await asyncio.sleep(0.05)
            wait_cycles += 1
            if wait_cycles > 40:  # 2s timeout
                break

        if actual_path.exists():
            with open(actual_path, "rb") as f:
                f.seek(start)
                while bytes_sent < bytes_to_send:
                    current_file_size = actual_path.stat().st_size
                    available_bytes = current_file_size - (start + bytes_sent)
                    if available_bytes <= 0:
                        if file_hash in self._inflight_downloads:
                            await asyncio.sleep(0.05)
                            continue
                        else:
                            break
                    read_len = min(chunk_size, bytes_to_send - bytes_sent, available_bytes)
                    data = f.read(read_len)
                    if not data:
                        break
                    yield data
                    bytes_sent += len(data)
                    await asyncio.sleep(0)


_cache_manager_instance: Optional[StreamCacheManager] = None


def get_stream_cache() -> StreamCacheManager:
    """Returns singleton instance of StreamCacheManager."""
    global _cache_manager_instance
    if _cache_manager_instance is None:
        _cache_manager_instance = StreamCacheManager()
    return _cache_manager_instance
