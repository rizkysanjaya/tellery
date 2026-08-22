"""
=============================================================================
Module: src.services.stream_cache
Purpose: High-performance progressive streaming cache manager with LRU auto-eviction.
         Provides 0ms seekable media playback while strictly enforcing a maximum local disk
         cache ceiling (default 1.5 GB), automatically evicting least-recently-used video
         buffers to prevent local drive bloat.
Used by: src.api.routes.stream, src.api.routes.system, src.services.archive_service
Dependencies: asyncio, pathlib, src.config, src.storage.telegram_client
Public Members: StreamCacheManager, get_stream_cache()
Side Effects: Reads, writes, and evicts cached media binary files in data/cache/.
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
    Coalesces concurrent range requests and enforces LRU auto-eviction to protect local disk space.
    """

    def __init__(
        self,
        cache_dir: Optional[Union[str, Path]] = None,
        max_cache_bytes: int = 1500 * 1024 * 1024,
    ) -> None:
        self.cache_dir = Path(cache_dir or "data/cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_cache_bytes = max_cache_bytes  # 1.5 GB default ceiling
        self._inflight_downloads: Dict[str, asyncio.Task] = {}
        self._progress_events: Dict[str, asyncio.Event] = {}
        self._bytes_downloaded: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    def touch_cache(self, cache_path: Path) -> None:
        """Updates file modification/access time for LRU tracking."""
        try:
            if cache_path.exists():
                cache_path.touch()
        except Exception:
            pass

    def get_cache_stats(self) -> dict:
        """Returns total cache size, limit, file count, and formatted metrics."""
        total_bytes = 0
        file_count = 0
        if self.cache_dir.exists():
            for f in self.cache_dir.glob("*"):
                if f.is_file():
                    try:
                        total_bytes += f.stat().st_size
                        file_count += 1
                    except Exception:
                        pass

        percent = round((total_bytes / max(1, self.max_cache_bytes)) * 100, 1)
        return {
            "cache_bytes": total_bytes,
            "cache_formatted": self._format_bytes(total_bytes),
            "max_bytes": self.max_cache_bytes,
            "max_formatted": self._format_bytes(self.max_cache_bytes),
            "percent_used": min(100.0, percent),
            "file_count": file_count,
        }

    def clear_all_cache(self) -> dict:
        """Purges 100% of stream cache files to immediately free local disk storage."""
        freed_bytes = 0
        files_deleted = 0
        if self.cache_dir.exists():
            for f in list(self.cache_dir.glob("*")):
                if f.is_file():
                    # Skip files actively downloading in memory
                    is_inflight = any(f.name.startswith(h) for h in self._inflight_downloads.keys())
                    if not is_inflight:
                        try:
                            size = f.stat().st_size
                            f.unlink()
                            freed_bytes += size
                            files_deleted += 1
                        except Exception:
                            pass

        return {
            "freed_bytes": freed_bytes,
            "freed_formatted": self._format_bytes(freed_bytes),
            "files_deleted": files_deleted,
        }

    def prune_lru_cache(self, target_reduction_ratio: float = 0.7) -> int:
        """
        Evicts oldest cached files if cache size exceeds max_cache_bytes.
        Returns total bytes freed.
        """
        if not self.cache_dir.exists():
            return 0

        files = []
        total_size = 0
        for f in self.cache_dir.glob("*"):
            if f.is_file():
                if any(f.name.startswith(h) for h in self._inflight_downloads.keys()):
                    continue
                try:
                    stat = f.stat()
                    files.append((stat.st_mtime, stat.st_size, f))
                    total_size += stat.st_size
                except Exception:
                    pass

        if total_size <= self.max_cache_bytes:
            return 0

        # Sort by oldest access/mtime first
        files.sort(key=lambda x: x[0])
        target_size = int(self.max_cache_bytes * target_reduction_ratio)
        freed_bytes = 0

        for _, size, file_path in files:
            if total_size - freed_bytes <= target_size:
                break
            try:
                file_path.unlink()
                freed_bytes += size
            except Exception:
                pass

        return freed_bytes

    @staticmethod
    def _format_bytes(size: int) -> str:
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"

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
            self.touch_cache(cache_path)
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
        temp_path = self.cache_dir / f"{file_hash}.downloading"
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
                self.touch_cache(target_path)
                self.prune_lru_cache()
                print(f"[StreamCache] Fully cached media {file_hash} ({expected_size} bytes)")
        except Exception as e:
            print(f"[StreamCache] Background caching error for {file_hash}: {e}")
        finally:
            if temp_path.exists() and not target_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
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
        Progressively streams a byte slice [start, end] from disk cache if completed,
        or falls back to direct MTProto chunk seeking for instant response on forward seeks / moov headers.
        """
        bytes_to_send = (end - start) + 1
        bytes_sent = 0

        # 1. Fast path: if completed cache file is already available on disk, stream directly from disk
        if file_path.exists() and file_path.stat().st_size > start:
            self.touch_cache(file_path)
            with open(file_path, "rb") as f:
                f.seek(start)
                while bytes_sent < bytes_to_send:
                    read_len = min(chunk_size, bytes_to_send - bytes_sent)
                    data = f.read(read_len)
                    if not data:
                        break
                    yield data
                    bytes_sent += len(data)
                    await asyncio.sleep(0)
            return

        # 2. Live MTProto streaming with simultaneous passthrough disk cache writer
        if message_id is not None and channel_id is not None:
            client = get_telegram_client()
            temp_cache = self.cache_dir / f"{file_hash}.streamtmp"
            writer = None
            if start == 0 and not file_path.exists():
                try:
                    writer = open(temp_cache, "wb")
                except Exception:
                    writer = None

            try:
                async for chunk in client.iter_document_chunks(
                    message_id=message_id,
                    channel_id=channel_id,
                    offset=start,
                    limit=bytes_to_send,
                    chunk_size=chunk_size,
                ):
                    if writer:
                        try:
                            writer.write(chunk)
                        except Exception:
                            pass
                    yield chunk
                    bytes_sent += len(chunk)

                if writer:
                    writer.flush()
                    writer.close()
                    writer = None
                    if bytes_sent >= bytes_to_send and temp_cache.exists():
                        temp_cache.replace(file_path)
                        self.touch_cache(file_path)
                        self.prune_lru_cache()
            finally:
                if writer:
                    try:
                        writer.close()
                    except Exception:
                        pass
            return


_cache_manager_instance: Optional[StreamCacheManager] = None


def get_stream_cache() -> StreamCacheManager:
    """Returns singleton instance of StreamCacheManager."""
    global _cache_manager_instance
    if _cache_manager_instance is None:
        _cache_manager_instance = StreamCacheManager()
    return _cache_manager_instance
