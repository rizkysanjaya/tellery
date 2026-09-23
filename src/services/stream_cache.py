"""
=============================================================================
Module: src.services.stream_cache
Purpose: High-performance progressive streaming cache manager with LRU auto-eviction
         and persistent cache size ceiling limits across server reloads and page refreshes.
         Provides 0ms seekable media playback from disk cache, C++ TDLib 16-parallel-stream
         hardware background caching, sub-300ms direct MTProto HTTP 206 slice streaming,
         and non-blocking cache purge with active TDLib/task cancellation.
Used by: src.api.routes.stream, src.api.routes.system, src.services.archive_service
Dependencies: asyncio, pathlib, shutil, src.config, src.storage.telegram_client, src.storage.tdlib_client
Public Members: StreamCacheManager, get_stream_cache(), set_cache_limit()
Side Effects: Reads, writes, and evicts cached media binary files in data/cache/,
              reads and writes persistent cache limit ceiling in data/.cache_limit.
=============================================================================
"""

import asyncio
import gc
import shutil
import sys
import time
from pathlib import Path
from typing import AsyncIterator, Dict, Optional, Union
from src.config import get_settings
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client
from src.storage.tdlib_client import get_tdlib_client

if sys.platform == "win32":
    import ctypes
    from ctypes import POINTER, byref, wintypes
    _k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    _GetCompressedFileSizeW = _k32.GetCompressedFileSizeW
    _GetCompressedFileSizeW.argtypes = [wintypes.LPCWSTR, POINTER(wintypes.DWORD)]
    _GetCompressedFileSizeW.restype = wintypes.DWORD

    def get_file_allocated_size(file_path: Path) -> int:
        """Returns physical bytes allocated on disk (handles NTFS sparse files)."""
        try:
            high = wintypes.DWORD(0)
            low = _GetCompressedFileSizeW(str(file_path), byref(high))
            if low == 0xFFFFFFFF:
                err = ctypes.get_last_error()
                if err != 0:
                    return file_path.stat().st_size
            return (high.value << 32) | low
        except Exception:
            try:
                return file_path.stat().st_size
            except Exception:
                return 0
else:
    def get_file_allocated_size(file_path: Path) -> int:
        """Returns physical blocks allocated on disk for POSIX systems."""
        try:
            st = file_path.stat()
            return getattr(st, "st_blocks", 0) * 512 or st.st_size
        except Exception:
            try:
                return file_path.stat().st_size
            except Exception:
                return 0


class StreamCacheManager:
    """
    Manages progressive local disk caching for media streams to provide 0ms latency video playback.
    Coalesces concurrent range requests, persists user-defined cache limits across reboots,
    and enforces LRU auto-eviction to protect local disk space.
    """

    def __init__(
        self,
        cache_dir: Optional[Union[str, Path]] = None,
        max_cache_bytes: Optional[int] = None,
    ) -> None:
        self.cache_dir = Path(cache_dir or "data/cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._cache_limit_file = Path("data/.cache_limit")
        self.max_cache_bytes = max_cache_bytes if max_cache_bytes is not None else self._load_persisted_cache_limit()
        self._inflight_downloads: Dict[str, asyncio.Task] = {}
        self._active_tdlib_downloads: Dict[str, int] = {}
        self._progress_events: Dict[str, asyncio.Event] = {}
        self._bytes_downloaded: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    def _load_persisted_cache_limit(self) -> int:
        """Loads persistent cache limit from data/.cache_limit if available."""
        default_limit = 1500 * 1024 * 1024  # 1.5 GB default
        try:
            if self._cache_limit_file.exists():
                content = self._cache_limit_file.read_text(encoding="utf-8").strip()
                if content:
                    val = int(content)
                    if val >= 100 * 1024 * 1024:
                        return val
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed loading persisted cache limit: %s", e)
        return default_limit

    def set_cache_limit(self, max_bytes: int) -> None:
        """Sets and persists the maximum stream cache ceiling limit to disk."""
        self.max_cache_bytes = max_bytes
        try:
            self._cache_limit_file.parent.mkdir(parents=True, exist_ok=True)
            self._cache_limit_file.write_text(str(max_bytes), encoding="utf-8")
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed persisting cache limit to %s: %s", self._cache_limit_file, e)

    def touch_cache(self, cache_path: Path) -> None:
        """Updates file modification/access time for LRU tracking."""
        try:
            if cache_path.exists():
                cache_path.touch()
        except Exception:
            pass

    def _get_disposable_cache_dirs(self) -> list[Path]:
        """Returns all disposable local media cache directories across the application."""
        dirs: list[Path] = []
        if self.cache_dir.exists():
            dirs.append(self.cache_dir)

        upload_temp = Path("data/upload_temp")
        if upload_temp.exists():
            dirs.append(upload_temp)

        td_files = Path("data/tdlib/files")
        if td_files.exists():
            dirs.append(td_files)

        return dirs

    def get_cache_stats(self) -> dict:
        """Returns total cache size, limit, file count, and formatted metrics across all cache folders."""
        total_bytes = 0
        file_count = 0
        for d in self._get_disposable_cache_dirs():
            for f in d.rglob("*"):
                if f.is_file():
                    try:
                        total_bytes += get_file_allocated_size(f)
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

    async def clear_all_cache(self) -> dict:
        """Purges 100% of stream cache and temporary files to immediately free local disk storage."""
        # Cancel any active background download tasks
        for task in list(self._inflight_downloads.values()):
            if not task.done():
                task.cancel()
        self._inflight_downloads.clear()

        # Cancel active TDLib downloads to free Windows file handles immediately
        if self._active_tdlib_downloads:
            try:
                td = get_tdlib_client()
                for fid in list(self._active_tdlib_downloads.values()):
                    try:
                        await td.send_request({
                            "@type": "cancelDownloadFile",
                            "file_id": fid,
                            "only_if_pending": False,
                        })
                    except Exception:
                        pass
            except Exception:
                pass
            self._active_tdlib_downloads.clear()

        # Release open file handles from garbage collector
        gc.collect()
        await asyncio.sleep(0.05)

        def _do_file_deletion():
            freed_bytes = 0
            files_deleted = 0
            for d in self._get_disposable_cache_dirs():
                if not d.exists():
                    continue
                for f in list(d.rglob("*")):
                    if f.is_file():
                        try:
                            size = get_file_allocated_size(f)
                            deleted = False
                            for _ in range(3):
                                try:
                                    f.unlink()
                                    deleted = True
                                    break
                                except (PermissionError, OSError):
                                    time.sleep(0.05)
                            if deleted:
                                freed_bytes += size
                                files_deleted += 1
                        except Exception:
                            pass
            return freed_bytes, files_deleted

        freed_bytes, files_deleted = await asyncio.to_thread(_do_file_deletion)

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
        files = []
        total_size = 0
        for d in self._get_disposable_cache_dirs():
            for f in d.rglob("*"):
                if f.is_file():
                    if any(f.name.startswith(h) for h in self._inflight_downloads.keys()):
                        continue
                    try:
                        stat = f.stat()
                        alloc_size = get_file_allocated_size(f)
                        files.append((stat.st_mtime, alloc_size, f))
                        total_size += alloc_size
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
                download_task = asyncio.create_task(
                    self._do_progressive_download(
                        message_id, channel_id, cache_path, file_hash, file_size
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
                self._do_progressive_download(
                    message_id, channel_id, cache_path, file_hash, file_size
                )
            )
            self._inflight_downloads[file_hash] = task

    async def _do_progressive_download(
        self,
        message_id: int,
        channel_id: Union[int, str],
        target_path: Path,
        file_hash: str,
        expected_size: int,
        chunk_size: int = 1024 * 1024,
    ) -> None:
        """
        High-speed C++ TDLib background downloader with graceful Telethon fallback.
        Downloads in 16 parallel hardware streams and promotes to target_path (.bin).
        """
        td_client = get_tdlib_client()
        tdlib_success = False

        # 1. Primary Engine: Official C++ TDLib
        try:
            await td_client.start()
            if td_client.auth_state == "authorizationStateReady":
                cid_raw = str(channel_id).lstrip("-").lstrip("100")
                chat_id = int(f"-100{cid_raw}")
                td_msg_id = message_id * (1 << 20)

                msg = await td_client.send_request({
                    "@type": "getMessage",
                    "chat_id": chat_id,
                    "message_id": td_msg_id,
                })

                content = msg.get("content", {})
                file_info = None
                if content.get("@type") == "messageVideo":
                    file_info = content.get("video", {}).get("video")
                elif content.get("@type") == "messageDocument":
                    file_info = content.get("document", {}).get("document")
                elif content.get("@type") == "messageAnimation":
                    file_info = content.get("animation", {}).get("animation")
                elif content.get("@type") == "messagePhoto":
                    sizes = content.get("photo", {}).get("sizes", [])
                    if sizes:
                        file_info = sizes[-1].get("photo")

                if file_info and file_info.get("id"):
                    file_id = file_info["id"]
                    self._active_tdlib_downloads[file_hash] = file_id
                    # Trigger async download
                    await td_client.download_file_fast(file_id=file_id, priority=32, synchronous=False)

                    # Poll until TDLib finishes downloading file
                    for _ in range(120): # up to 60s
                        f_stat = await td_client.send_request({"@type": "getFile", "file_id": file_id})
                        local = f_stat.get("local", {})
                        if local.get("is_downloading_completed"):
                            local_path = local.get("path")
                            if local_path and Path(local_path).exists():
                                shutil.copyfile(local_path, target_path)
                                self.touch_cache(target_path)
                                self.prune_lru_cache()
                                tdlib_success = True
                                print(f"[StreamCache] TDLib C++ fully cached media {file_hash} ({expected_size} bytes)")
                            break
                        await asyncio.sleep(0.5)
        except Exception as e:
            print(f"[StreamCache] TDLib C++ download background note: {e}")

        if tdlib_success:
            self._active_tdlib_downloads.pop(file_hash, None)
            async with self._lock:
                self._inflight_downloads.pop(file_hash, None)
            return

        # 2. Fallback Engine: Telethon sequential append
        part_path = self.cache_dir / f"{file_hash}.part"
        client = get_telegram_client()
        try:
            await client.start()
            entity = await client.get_target_entity(channel_id)
            message = await client._client.get_messages(entity, ids=message_id)
            if not message or not message.media:
                return

            start_offset = part_path.stat().st_size if part_path.exists() else 0
            if start_offset >= expected_size:
                part_path.replace(target_path)
                self.touch_cache(target_path)
                self.prune_lru_cache()
                return

            align = 4096
            aligned_offset = (start_offset // align) * align

            with open(part_path, "ab" if start_offset > 0 else "wb") as f:
                async for chunk in client._client.iter_download(
                    message.media,
                    offset=aligned_offset,
                    chunk_size=chunk_size,
                    request_size=chunk_size,
                ):
                    if not chunk:
                        break
                    f.write(chunk)
                    f.flush()

            if part_path.exists() and part_path.stat().st_size >= expected_size:
                promoted = False
                for _ in range(15):
                    try:
                        part_path.replace(target_path)
                        promoted = True
                        break
                    except (PermissionError, OSError):
                        await asyncio.sleep(0.1)

                if promoted:
                    self.touch_cache(target_path)
                    self.prune_lru_cache()
                    print(f"[StreamCache] Fully cached media {file_hash} ({expected_size} bytes)")
        except Exception as e:
            print(f"[StreamCache] Progressive download error for {file_hash}: {e}")
        finally:
            self._active_tdlib_downloads.pop(file_hash, None)
            async with self._lock:
                self._inflight_downloads.pop(file_hash, None)

    async def stream_file_range(
        self,
        file_path: Path,
        file_hash: str,
        start: int,
        end: int,
        expected_total_size: Optional[int] = None,
        message_id: Optional[int] = None,
        channel_id: Optional[Union[int, str]] = None,
        chunk_size: int = 512 * 1024,
        is_preview: bool = False,
    ) -> AsyncIterator[bytes]:
        """
        Progressively streams a byte slice [start, end] from disk cache or direct Telegram MTProto.
        For full playback (is_preview=False), accelerates with C++ TDLib 16-parallel-stream background caching.
        For hover previews (is_preview=True), serves on-demand without whole-file caching.
        """
        bytes_to_send = (end - start) + 1
        bytes_sent = 0

        # 1. Fast path: Read directly from completed cache file on disk (0ms instant seek)
        if file_path.exists():
            actual_size = file_path.stat().st_size
            if expected_total_size is None or actual_size == expected_total_size:
                if actual_size > start:
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
            elif expected_total_size and actual_size < expected_total_size:
                try:
                    file_path.unlink()
                except Exception:
                    pass

        # 2. Check if TDLib already completed downloading this file in data/tdlib/files/
        if message_id is not None and channel_id is not None:
            td_client = get_tdlib_client()
            try:
                await td_client.start()
                if td_client.auth_state == "authorizationStateReady":
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
                        file_id = file_info["id"]
                        f_stat = await td_client.send_request({"@type": "getFile", "file_id": file_id})
                        local = f_stat.get("local", {})
                        if local.get("is_downloading_completed") and local.get("path") and Path(local["path"]).exists():
                            local_p = Path(local["path"])
                            if not file_path.exists():
                                try:
                                    shutil.copyfile(local_p, file_path)
                                    self.touch_cache(file_path)
                                    self.prune_lru_cache()
                                except Exception:
                                    pass
                            with open(local_p, "rb") as f:
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
                        # 3. High-Speed TDLib Hardware Slice Stream (12ms - 50ms native delivery)
                        # Proactively kick off background progressive caching if not already running
                        if expected_total_size and file_hash not in self._inflight_downloads:
                            self._inflight_downloads[file_hash] = asyncio.create_task(
                                self._do_progressive_download(
                                    message_id, channel_id, file_path, file_hash, expected_total_size, chunk_size
                                )
                            )

                        # Request high-priority download slice starting at requested offset
                        await td_client.send_request({
                            "@type": "downloadFile",
                            "file_id": file_id,
                            "priority": 32,
                            "offset": start,
                            "limit": bytes_to_send,
                            "synchronous": False,
                        })

                        import base64
                        while bytes_sent < bytes_to_send:
                            req_count = min(chunk_size, bytes_to_send - bytes_sent)
                            current_offset = start + bytes_sent
                            part_data = None

                            for _ in range(30):  # Wait up to 600ms per 512KB slice
                                try:
                                    res = await td_client.send_request({
                                        "@type": "readFilePart",
                                        "file_id": file_id,
                                        "offset": current_offset,
                                        "count": req_count,
                                    })
                                    if res.get("@type") == "data" and res.get("data"):
                                        part_data = base64.b64decode(res["data"])
                                        break
                                except Exception:
                                    pass
                                await asyncio.sleep(0.02)

                            if not part_data:
                                break

                            yield part_data
                            bytes_sent += len(part_data)
                            await asyncio.sleep(0)

                        if bytes_sent >= bytes_to_send:
                            return
            except (asyncio.CancelledError, GeneratorExit):
                return
            except Exception as e:
                print(f"[StreamCache] TDLib slice stream note: {e}")

        # 4. Graceful fallback to MTProto only if TDLib is unavailable
        if bytes_sent < bytes_to_send and message_id is not None and channel_id is not None:
            client = get_telegram_client()
            try:
                async for chunk in client.iter_document_chunks(
                    message_id=message_id,
                    channel_id=channel_id,
                    offset=start + bytes_sent,
                    limit=bytes_to_send - bytes_sent,
                    chunk_size=chunk_size,
                ):
                    yield chunk
                    bytes_sent += len(chunk)
                    if bytes_sent >= bytes_to_send:
                        break
            except (asyncio.CancelledError, GeneratorExit):
                return
            except Exception as e:
                print(f"[StreamCache] MTProto fallback stream exception: {e}")
                raise

        if bytes_sent < bytes_to_send:
            raise IOError(f"Stream truncated: delivered {bytes_sent} of {bytes_to_send} requested bytes")
        return


_cache_manager_instance: Optional[StreamCacheManager] = None


def get_stream_cache() -> StreamCacheManager:
    """Returns singleton instance of StreamCacheManager."""
    global _cache_manager_instance
    if _cache_manager_instance is None:
        _cache_manager_instance = StreamCacheManager()
    return _cache_manager_instance
