"""
=============================================================================
Module: src.services.stream_cache
Purpose: High-performance streaming cache manager for instant seekable video/media playback.
         Eliminates Telegram MTProto network latency by caching streamed media locally
         with deduplicated in-flight fetch coordination.
Used by: src.api.routes.stream
Dependencies: asyncio, aiofiles, pathlib, src.config, src.storage.telegram_client
Public Members: StreamCacheManager, get_stream_cache()
Side Effects: Reads/writes cached binary files in data/cache/.
=============================================================================
"""

import asyncio
from pathlib import Path
from typing import AsyncIterator, Dict, Optional, Union
from src.config import get_settings
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client


class StreamCacheManager:
    """
    Manages local disk caching for media streams to provide 0ms latency video playback.
    Coalesces concurrent range requests for the same media into a single MTProto download.
    """

    def __init__(self, cache_dir: Optional[Union[str, Path]] = None) -> None:
        self.cache_dir = Path(cache_dir or "data/cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._inflight_downloads: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    def get_cache_path(self, file_hash: str) -> Path:
        """Returns the local cache file path for a given SHA-256 file hash."""
        return self.cache_dir / f"{file_hash}.bin"

    def is_cached_and_complete(self, file_hash: str, expected_size: int) -> bool:
        """Checks if a file is already fully cached on local disk."""
        target = self.get_cache_path(file_hash)
        return target.exists() and target.stat().st_size == expected_size

    async def ensure_cached(
        self,
        message_id: int,
        channel_id: Union[int, str],
        file_hash: str,
        file_size: int,
        telegram_client: Optional[TelegramStorageClient] = None,
    ) -> Path:
        """
        Ensures the media file is fully available in the local cache.
        If not cached, downloads from Telegram in background while deduplicating in-flight tasks.
        """
        cache_path = self.get_cache_path(file_hash)

        # 1. Cache HIT
        if cache_path.exists() and cache_path.stat().st_size == file_size:
            return cache_path

        # 2. Coordinate concurrent downloads for the same file
        async with self._lock:
            if file_hash in self._inflight_downloads:
                download_task = self._inflight_downloads[file_hash]
            else:
                client = telegram_client or get_telegram_client()
                download_task = asyncio.create_task(
                    self._do_download(client, message_id, channel_id, cache_path, file_hash)
                )
                self._inflight_downloads[file_hash] = download_task

        # Await completion
        await download_task
        return cache_path

    async def _do_download(
        self,
        client: TelegramStorageClient,
        message_id: int,
        channel_id: Union[int, str],
        target_path: Path,
        file_hash: str,
    ) -> None:
        temp_path = self.cache_dir / f"{file_hash}.tmp"
        try:
            await client.download_document(
                message_id=message_id,
                channel_id=channel_id,
                destination=temp_path,
            )
            # Atomic rename on completion
            if temp_path.exists():
                temp_path.replace(target_path)
        except Exception as e:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
            raise e
        finally:
            async with self._lock:
                self._inflight_downloads.pop(file_hash, None)

    async def stream_file_range(
        self,
        file_path: Path,
        start: int,
        end: int,
        chunk_size: int = 256 * 1024,
    ) -> AsyncIterator[bytes]:
        """
        Streams a byte slice [start, end] directly from a local disk file with high throughput.
        """
        bytes_to_send = (end - start) + 1
        bytes_sent = 0

        with open(file_path, "rb") as f:
            f.seek(start)
            while bytes_sent < bytes_to_send:
                read_len = min(chunk_size, bytes_to_send - bytes_sent)
                data = f.read(read_len)
                if not data:
                    break
                yield data
                bytes_sent += len(data)
                # Yield control to event loop to allow concurrent requests to progress
                await asyncio.sleep(0)


_cache_manager_instance: Optional[StreamCacheManager] = None


def get_stream_cache() -> StreamCacheManager:
    """Returns singleton instance of StreamCacheManager."""
    global _cache_manager_instance
    if _cache_manager_instance is None:
        _cache_manager_instance = StreamCacheManager()
    return _cache_manager_instance
