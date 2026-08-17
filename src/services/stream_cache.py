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

    async def _do_progressive_download(
        self,
        client: TelegramStorageClient,
        message_id: int,
        channel_id: Union[int, str],
        target_path: Path,
        file_hash: str,
        expected_size: int,
    ) -> None:
        """
        Progressively streams chunks from Telegram MTProto into the cache file,
        pulsing the progress event after each chunk to wake up active stream readers.
        """
        temp_path = self.cache_dir / f"{file_hash}.part"
        try:
            await client.start()
            entity = await client.get_target_entity(channel_id)
            message = await client._client.get_messages(entity, ids=message_id)
            if not message or not message.media:
                raise ValueError(f"No media found for message {message_id}")

            with open(temp_path, "wb") as f:
                async for chunk in client._client.iter_download(
                    message.media,
                    chunk_size=512 * 1024,  # Maximum MTProto throughput
                ):
                    if not chunk:
                        break
                    f.write(chunk)
                    f.flush()

                    # Notify waiting stream readers
                    self._bytes_downloaded[file_hash] = f.tell()
                    event = self._progress_events.get(file_hash)
                    if event:
                        event.set()
                        event.clear()
                    await asyncio.sleep(0)

            # Atomic swap to complete cache file
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
                self._progress_events.pop(file_hash, None)
                self._bytes_downloaded.pop(file_hash, None)

    async def stream_file_range(
        self,
        file_path: Path,
        file_hash: str,
        start: int,
        end: int,
        chunk_size: int = 256 * 1024,
    ) -> AsyncIterator[bytes]:
        """
        Progressively streams a byte slice [start, end] from disk with live waiting
        for active in-flight downloads.
        """
        bytes_to_send = (end - start) + 1
        bytes_sent = 0
        part_path = self.cache_dir / f"{file_hash}.part"

        # Determine which path to open (completed cache file or active .part file)
        actual_path = file_path if file_path.exists() else part_path

        # Wait until file is created and has enough bytes to reach `start`
        wait_cycles = 0
        while not actual_path.exists() or actual_path.stat().st_size <= start:
            if file_path.exists():
                actual_path = file_path
                break
            if file_hash not in self._inflight_downloads and not actual_path.exists():
                break
            await asyncio.sleep(0.05)
            wait_cycles += 1
            if wait_cycles > 100:  # 5s timeout
                break

        if not actual_path.exists():
            return

        with open(actual_path, "rb") as f:
            f.seek(start)
            while bytes_sent < bytes_to_send:
                current_file_size = actual_path.stat().st_size
                available_bytes = current_file_size - (start + bytes_sent)

                if available_bytes <= 0:
                    # If still downloading, wait for next chunk
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


_cache_manager_instance: Optional[StreamCacheManager] = None


def get_stream_cache() -> StreamCacheManager:
    """Returns singleton instance of StreamCacheManager."""
    global _cache_manager_instance
    if _cache_manager_instance is None:
        _cache_manager_instance = StreamCacheManager()
    return _cache_manager_instance
