"""
=============================================================================
Module: src.services.archive_service
Purpose: High-level media archival orchestration, deduplication, EXIF extraction, WebP thumbnails,
         safe soft-delete (Trash), 1-click restore, permanent vault purging with batch MTProto deletions,
         channel ID canonicalization, and in-flight upload coordination.
Used by: src.cli.verify_pipeline, src.cli.import_folder, FastAPI routes (media, sync, stream).
Dependencies: src.database.repository, src.database.connection, src.storage.telegram_client,
              src.storage.tdlib_client, src.services.hasher, src.services.metadata_extractor,
              src.services.thumbnail_service, src.config
Public Members: ArchiveService (archive_file, is_message_in_flight, delete_media_item, restore_media_item, restore_batch, purge_media_permanently, empty_trash, etc.)
Side Effects: Database reads/writes, MTProto network uploads/downloads/deletes, local WebP file creation, audit logging.
=============================================================================
"""

import asyncio
from pathlib import Path
from typing import Any, Callable, Optional, Union
from telethon.errors import FloodWaitError
from src.config import get_settings
from src.database.connection import normalize_channel_id
from src.database.repository import MediaRepository
from src.services.hasher import compute_bytes_sha256, compute_file_sha256
from src.services.metadata_extractor import extract_media_metadata
from src.services.thumbnail_service import generate_thumbnail
from src.services.transcoder_service import ensure_web_stream_ready
from src.storage.tdlib_client import get_tdlib_client
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client


class ArchiveService:
    r"""
    Orchestrates the entire archival flow:
    1. Computes local cryptographic SHA-256 hash.
    2. Performs O(log N) deduplication check in SQLite.
    3. Extracts EXIF and media technical metadata.
    4. Generates local WebP thumbnails.
    5. Archives uncompressed document to Telegram Vault.
    6. Tracks in-flight Telegram message IDs to block live-sync duplicate races.
    """

    _in_flight_message_ids: set[int] = set()

    @classmethod
    def is_message_in_flight(cls, msg_id: int) -> bool:
        """Checks if a Telegram message ID is currently undergoing active archival in-memory."""
        return msg_id in cls._in_flight_message_ids

    def __init__(
        self,
        repository: Optional[MediaRepository] = None,
        telegram_client: Optional[TelegramStorageClient] = None,
    ) -> None:
        self.repository = repository or MediaRepository()
        self.telegram_client = telegram_client or get_telegram_client()
        self.settings = get_settings()

    async def archive_file(
        self,
        file_path: Union[str, Path],
        channel_id: Optional[Union[int, str]] = None,
        mime_type: Optional[str] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> dict[str, Any]:
        """
        Archives a local file into Telegram with automatic deduplication,
        EXIF parsing, and local WebP thumbnail generation.

        Returns:
            dict containing operation status ('uploaded' or 'duplicate') and media metadata.
        """
        target_path = Path(file_path)
        if not target_path.exists():
            raise FileNotFoundError(f"File not found: {target_path}")

        target_channel = normalize_channel_id(channel_id or self.settings.tg_channel_id)
        if not target_channel:
            raise ValueError("Telegram channel ID is required for archiving.")

        # 1. Compute SHA-256 and byte size
        file_hash, file_size = compute_file_sha256(target_path)

        # 2. Check for deduplication in SQLite scoped to target channel
        existing = await self.repository.get_by_hash(file_hash, channel_id=target_channel)
        if existing:
            await self.repository.log_audit(
                action="DEDUP_HIT",
                media_id=existing["id"],
                file_hash=file_hash,
                details=f"Skipped duplicate upload for '{target_path.name}'",
            )
            return {
                "status": "duplicate",
                "media_id": existing["id"],
                "file_hash": file_hash,
                "file_name": existing["file_name"],
                "telegram_message_id": existing["telegram_message_id"],
                "item": existing,
                "message": "File already exists in catalog. Upload skipped.",
            }

        # 3. Extract deep EXIF and technical metadata
        meta = extract_media_metadata(target_path)
        final_mime_type = mime_type or meta.mime_type

        # 4. Generate local WebP thumbnail (photos and videos)
        thumbnail_path = generate_thumbnail(target_path, file_hash, final_mime_type)

        # 5. Ephemeral upload architecture:
        # The file remains in its transient buffer strictly for hashing, metadata extraction,
        # and MTProto chunk upload. We do NOT retain the full binary in local stream cache,
        # preserving the zero-storage footprint invariant for cloud-backed vaults.
        # Once upload succeeds, the route's finally block unlinks the transient buffer cleanly.

        # 6. Upload uncompressed document to Telegram Vault
        uploaded_msg_id: Optional[int] = None
        telegram_file_id: Optional[str] = None
        tdlib_client = get_tdlib_client()

        # Engine 1: Native C++ TDLib Multi-Threaded Uploader
        try:
            await tdlib_client.start()
            if tdlib_client.auth_state == "authorizationStateReady":
                td_res = await tdlib_client.upload_document(
                    file_path=target_path,
                    channel_id=target_channel,
                    progress_callback=progress_callback,
                )
                uploaded_msg_id = td_res["id"]
                telegram_file_id = td_res.get("document_id")
                print(f"[Archive] TDLib C++ uploaded '{target_path.name}' to message {uploaded_msg_id}")
        except Exception as e:
            print(f"[Archive] TDLib C++ upload attempt note: {e}, falling back to Telethon...")

        # Engine 2: Fallback to Multi-Worker Telethon MTProto Pool
        if uploaded_msg_id is None:
            max_retries = 3
            message = None
            for attempt in range(max_retries):
                try:
                    message = await self.telegram_client.upload_document(
                        file_path=target_path,
                        channel_id=target_channel,
                        progress_callback=progress_callback,
                    )
                    break
                except FloodWaitError as e:
                    wait_time = e.seconds + 2
                    print(f"[RateLimit] Telegram requested wait of {e.seconds}s. Backing off for {wait_time}s...")
                    await asyncio.sleep(wait_time)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    await asyncio.sleep(2)

            if not message:
                raise RuntimeError(f"Failed to upload {target_path.name} to Telegram after retries.")

            uploaded_msg_id = message.id
            if message.document:
                telegram_file_id = str(message.document.id)

        if uploaded_msg_id:
            ArchiveService._in_flight_message_ids.add(uploaded_msg_id)

        try:
            # 7. Insert into SQLite catalog
            item_data = {
                "file_hash": file_hash,
                "file_name": target_path.name,
                "file_size": file_size,
                "mime_type": final_mime_type,
                "telegram_channel_id": target_channel,
                "telegram_message_id": uploaded_msg_id,
                "telegram_file_id": telegram_file_id,
                "width": meta.width,
                "height": meta.height,
                "duration_seconds": meta.duration_seconds,
                "camera_make": meta.camera_make,
                "camera_model": meta.camera_model,
                "date_taken": meta.date_taken,
                "thumbnail_path": thumbnail_path,
            }

            media_id = await self.repository.insert_media(item_data)

            # 8. Record audit log
            await self.repository.log_audit(
                action="UPLOAD",
                media_id=media_id,
                file_hash=file_hash,
                details=f"Uploaded '{target_path.name}' ({file_size} bytes) to message {uploaded_msg_id}",
            )
        finally:
            if uploaded_msg_id:
                ArchiveService._in_flight_message_ids.discard(uploaded_msg_id)

        return {
            "status": "uploaded",
            "media_id": media_id,
            "file_hash": file_hash,
            "file_name": target_path.name,
            "file_size": file_size,
            "mime_type": final_mime_type,
            "width": meta.width,
            "height": meta.height,
            "camera_make": meta.camera_make,
            "camera_model": meta.camera_model,
            "date_taken": meta.date_taken,
            "thumbnail_path": thumbnail_path,
            "telegram_channel_id": target_channel,
            "telegram_message_id": uploaded_msg_id,
            "message": "File successfully uploaded and indexed in catalog.",
        }

    async def verify_media_integrity(
        self,
        media_id: int,
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Downloads a media document directly from Telegram and asserts byte-for-byte
        cryptographic hash equality against the catalog SHA-256.

        Returns:
            tuple[bool, dict]: (is_valid, validation_report)
        """
        media = await self.repository.get_by_id(media_id)
        if not media:
            raise ValueError(f"Media item with ID {media_id} not found in catalog.")

        downloaded_bytes = await self.telegram_client.download_document_bytes(
            message_id=media["telegram_message_id"],
            channel_id=media["telegram_channel_id"],
            progress_callback=progress_callback,
        )

        downloaded_hash = compute_bytes_sha256(downloaded_bytes)
        is_identical = (downloaded_hash == media["file_hash"]) and (
            len(downloaded_bytes) == media["file_size"]
        )

        action = "VERIFY_SUCCESS" if is_identical else "VERIFY_FAILURE"
        details = (
            f"Expected: {media['file_hash']} ({media['file_size']}B), "
            f"Got: {downloaded_hash} ({len(downloaded_bytes)}B)"
        )
        await self.repository.log_audit(
            action=action,
            media_id=media_id,
            file_hash=downloaded_hash,
            details=details,
        )

        report = {
            "media_id": media_id,
            "file_name": media["file_name"],
            "expected_hash": media["file_hash"],
            "downloaded_hash": downloaded_hash,
            "expected_bytes": media["file_size"],
            "downloaded_bytes": len(downloaded_bytes),
            "is_identical": is_identical,
        }
        return is_identical, report

    async def delete_media_item(self, media_id: int) -> dict[str, Any]:
        """
        Soft deletes media item (moves to Trash) while preserving Telegram vault message
        and disk thumbnail for instantaneous recovery.
        """
        media = await self.repository.get_by_id(media_id)
        if not media:
            raise ValueError(f"Media item with ID {media_id} not found in catalog.")

        # Soft delete in catalog
        await self.repository.delete_media(media_id)

        # Audit log
        await self.repository.log_audit(
            action="TRASH",
            media_id=media_id,
            file_hash=media["file_hash"],
            details=f"Moved '{media['file_name']}' to Trash",
        )

        return {
            "status": "trashed",
            "media_id": media_id,
            "file_name": media["file_name"],
            "message": "Media item moved to Trash.",
        }

    async def restore_media_item(self, media_id: int) -> dict[str, Any]:
        """
        Restores a soft-deleted media item from Trash back to the active gallery.
        """
        media = await self.repository.get_by_id(media_id, include_deleted=True)
        if not media:
            raise ValueError(f"Media item with ID {media_id} not found.")

        success = await self.repository.restore_media(media_id)
        if not success:
            raise RuntimeError(f"Failed to restore media item {media_id}.")

        await self.repository.log_audit(
            action="RESTORE",
            media_id=media_id,
            file_hash=media["file_hash"],
            details=f"Restored '{media['file_name']}' from Trash",
        )

        return {
            "status": "restored",
            "media_id": media_id,
            "file_name": media["file_name"],
            "message": "Media item restored to gallery.",
        }

    async def restore_batch(self, media_ids: list[int]) -> dict[str, Any]:
        """
        Restores multiple media items from Trash in bulk.
        """
        count = await self.repository.restore_batch(media_ids)
        return {
            "status": "restored",
            "count": count,
            "message": f"Successfully restored {count} item(s) to gallery.",
        }

    async def purge_media_permanently(self, media_id: int) -> dict[str, Any]:
        """
        Permanently removes a media item from Telegram MTProto storage, disk thumbnail cache,
        streaming disk cache, and SQLite catalog.
        """
        media = await self.repository.get_by_id(media_id, include_deleted=True)
        if not media:
            raise ValueError(f"Media item with ID {media_id} not found.")

        # 1. Delete message from Telegram storage channel
        try:
            await self.telegram_client.delete_document(
                message_id=media["telegram_message_id"],
                channel_id=media["telegram_channel_id"],
            )
        except Exception as e:
            print(f"[Warning] Failed to delete message {media['telegram_message_id']} from Telegram: {e}")

        # 2. Delete local WebP thumbnail from disk
        thumb_path = media.get("thumbnail_path")
        if thumb_path:
            p = Path(thumb_path)
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass

        # 3. Clean up streaming disk cache if exists
        try:
            from src.services.stream_cache import get_stream_cache
            cache = get_stream_cache()
            bin_path = cache.get_cache_path(media["file_hash"])
            if bin_path.exists():
                bin_path.unlink()
        except Exception:
            pass

        # 4. Permanently purge from database
        await self.repository.purge_media_permanently(media_id)

        # 5. Audit log
        await self.repository.log_audit(
            action="PURGE_PERMANENT",
            media_id=media_id,
            file_hash=media["file_hash"],
            details=f"Permanently purged '{media['file_name']}' from Telegram vault and database",
        )

        return {
            "status": "permanently_deleted",
            "media_id": media_id,
            "file_name": media["file_name"],
            "message": "Media permanently deleted from Telegram vault and database.",
        }

    async def empty_trash(self, channel_id: Optional[int] = None) -> dict[str, Any]:
        """
        Permanently purges all items currently in Trash from Telegram storage and database,
        optionally scoped to a specific channel.
        Uses batch MTProto message deletion (up to 100 messages per call) to maximize throughput.
        """
        target_ch = normalize_channel_id(channel_id)
        items = await self.repository.get_all_trash_media(channel_id=target_ch)
        if not items:
            return {
                "status": "emptied",
                "purged_count": 0,
                "message": "Trash is already empty.",
            }

        # 1. Group Telegram message IDs by channel for batch deletion
        by_channel: dict[int, list[int]] = {}
        for media in items:
            ch_id = media.get("telegram_channel_id")
            mid = media.get("telegram_message_id")
            if ch_id and mid:
                by_channel.setdefault(ch_id, []).append(mid)

        for ch_id, msg_ids in by_channel.items():
            try:
                await self.telegram_client.delete_documents(
                    message_ids=msg_ids,
                    channel_id=ch_id,
                )
            except Exception as e:
                print(f"[Warning] Batch Telegram delete failed for channel {ch_id}: {e}")

        # 2. Disk cache & thumbnail cleanup, plus atomic database purging
        from src.services.stream_cache import get_stream_cache
        cache = get_stream_cache()
        purged_count = 0

        for media in items:
            # Delete thumbnail
            thumb_path = media.get("thumbnail_path")
            if thumb_path:
                p = Path(thumb_path)
                if p.exists():
                    try:
                        p.unlink()
                    except Exception:
                        pass

            # Clean cache file
            try:
                bin_path = cache.get_cache_path(media["file_hash"])
                if bin_path.exists():
                    bin_path.unlink()
            except Exception:
                pass

            # Purge from DB (atomically purges any duplicate rows for the same message)
            await self.repository.purge_media_permanently(media["id"])
            purged_count += 1

        return {
            "status": "emptied",
            "purged_count": purged_count,
            "message": f"Successfully emptied Trash. Permanently deleted {purged_count} item(s).",
        }
