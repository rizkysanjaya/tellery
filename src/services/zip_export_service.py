"""
=============================================================================
Module: src.services.zip_export_service
Purpose: High-performance, streaming-safe ZIP archive generation for batch media downloads
         and full album exports using ZIP_STORED, with Zip Slip path sanitization.
Used by: src.api.routes.media, src.api.routes.folders
Dependencies: zipfile, asyncio, pathlib, uuid, src.database.repository, src.storage.telegram_client, src.services.stream_cache
Public Members: ZipExportService, get_zip_export_service()
Side Effects: Spools temporary .zip files in data/temp/downloads/, cleans up via background tasks.
=============================================================================
"""

import asyncio
import os
import shutil
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any, List, Optional
from src.database.repository import MediaRepository
from src.services.stream_cache import get_stream_cache
from src.storage.telegram_client import get_telegram_client


class ZipExportService:
    """
    Assembles ZIP archives for batch media items and albums.
    Employs ZIP_STORED (no re-compression) to achieve near-instant assembly at full SSD/network speeds.
    """

    def __init__(self, temp_dir: Optional[Path] = None):
        self.temp_dir = temp_dir or Path("data/temp/downloads")
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def cleanup_archive(self, archive_path: Path) -> None:
        """Removes temporary archive file after client stream finishes."""
        try:
            if archive_path.exists():
                archive_path.unlink()
        except Exception as e:
            print(f"[Warning] Failed to cleanup temp archive {archive_path}: {e}")

    def purge_stale_temp_files(self, max_age_seconds: int = 7200) -> int:
        """Purges any orphaned temporary zip files older than max_age_seconds."""
        purged = 0
        now = time.time()
        try:
            for item in self.temp_dir.glob("*.zip"):
                try:
                    if item.is_file() and (now - item.stat().st_mtime) > max_age_seconds:
                        item.unlink()
                        purged += 1
                except Exception:
                    pass
        except Exception:
            pass
        return purged

    async def _resolve_media_file_path(self, item: dict[str, Any]) -> Optional[Path]:
        """
        Locates or fetches on-demand the full media file on local disk.
        Checks:
        1. Streaming cache: data/cache/{file_hash}.bin
        2. Native TDLib cache
        3. Telethon on-demand download fallback
        """
        cache_manager = get_stream_cache()
        file_hash = item["file_hash"]
        expected_size = item["file_size"]
        cache_path = cache_manager.get_cache_path(file_hash)

        # 1. Check if already complete in data/cache
        if cache_path.exists() and cache_path.stat().st_size == expected_size:
            cache_manager.touch_cache(cache_path)
            return cache_path

        # 2. Check TDLib local files
        try:
            from src.storage.tdlib_client import get_tdlib_client
            td_client = get_tdlib_client()
            if td_client.auth_state == "authorizationStateReady":
                cid_raw = str(item["telegram_channel_id"]).lstrip("-").lstrip("100")
                chat_id = int(f"-100{cid_raw}")
                td_msg_id = item["telegram_message_id"] * (1 << 20)
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
                    local_path = f_stat.get("local", {}).get("path")
                    if local_path and Path(local_path).exists():
                        lp = Path(local_path)
                        if lp.stat().st_size == expected_size:
                            # Promote to stream cache for future instant reuse
                            try:
                                shutil.copyfile(lp, cache_path)
                                cache_manager.touch_cache(cache_path)
                                return cache_path
                            except Exception:
                                return lp
        except Exception:
            pass

        # 3. Download via MTProto client
        try:
            telegram_client = get_telegram_client()
            temp_download_path = self.temp_dir / f"dl_{file_hash[:12]}_{uuid.uuid4().hex[:6]}.bin"
            await telegram_client.download_document(
                message_id=item["telegram_message_id"],
                channel_id=item["telegram_channel_id"],
                destination=temp_download_path,
            )
            if temp_download_path.exists() and temp_download_path.stat().st_size == expected_size:
                # Save to cache
                try:
                    shutil.move(str(temp_download_path), str(cache_path))
                    cache_manager.touch_cache(cache_path)
                    cache_manager.prune_lru_cache()
                    return cache_path
                except Exception:
                    return temp_download_path
            return temp_download_path
        except Exception as e:
            print(f"[Error] Failed to download media {item.get('id')} for zip export: {e}")
            return None

    async def create_batch_archive(self, media_ids: List[int]) -> Path:
        """
        Creates a ZIP archive containing the requested media items.
        Returns the absolute Path to the temporary .zip file.
        """
        self.purge_stale_temp_files()
        archive_id = uuid.uuid4().hex[:8]
        zip_path = self.temp_dir / f"telegallery_batch_{archive_id}.zip"

        items = []
        for mid in media_ids:
            item = await MediaRepository.get_by_id(mid)
            if item and not item.get("is_deleted"):
                items.append(item)

        if not items:
            raise ValueError("No valid active media items found for download.")

        # Deduplicate archive filenames
        used_names: set[str] = set()
        resolved_files: list[tuple[Path, str]] = []

        for item in items:
            file_path = await self._resolve_media_file_path(item)
            if not file_path or not file_path.exists():
                continue

            raw_base = item.get("file_name") or f"media_{item['id']}.bin"
            base_name = Path(raw_base).name.strip()
            base_name = "".join(c for c in base_name if c.isprintable() and c not in '<>:"/\\|?*\0')
            if not base_name or base_name in (".", ".."):
                base_name = f"media_{item['id']}.bin"
            target_name = base_name
            counter = 1
            name_stem = Path(base_name).stem
            name_suffix = Path(base_name).suffix

            while target_name in used_names:
                target_name = f"{name_stem} ({counter}){name_suffix}"
                counter += 1

            used_names.add(target_name)
            resolved_files.append((file_path, target_name))

        if not resolved_files:
            raise RuntimeError("Failed to resolve files for archive generation.")

        # Build ZIP with ZIP_STORED (fastest I/O, no CPU compression waste on JPEG/MP4)
        def _write_zip():
            with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
                for disk_path, arc_name in resolved_files:
                    zf.write(disk_path, arcname=arc_name)

        await asyncio.to_thread(_write_zip)
        return zip_path

    async def create_album_archive(self, folder_id: int) -> tuple[Path, str]:
        """
        Creates a ZIP archive containing all media items assigned to an album.
        Returns (archive_path, sanitized_album_name).
        """
        folder = await MediaRepository.get_folder(folder_id)
        if not folder:
            raise ValueError(f"Album with ID {folder_id} not found.")

        album_name = folder["name"]
        sanitized_name = "".join(c for c in album_name if c.isalnum() or c in " ._-").strip() or f"album_{folder_id}"

        # Fetch all media items in this folder
        items = await MediaRepository.get_all_folder_media(folder_id)
        if not items:
            raise ValueError(f"Album '{album_name}' has no media items to export.")

        media_ids = [item["id"] for item in items]
        zip_path = await self.create_batch_archive(media_ids)
        return zip_path, sanitized_name


_zip_export_service: Optional[ZipExportService] = None


def get_zip_export_service() -> ZipExportService:
    """Singleton factory for ZipExportService."""
    global _zip_export_service
    if _zip_export_service is None:
        _zip_export_service = ZipExportService()
    return _zip_export_service
