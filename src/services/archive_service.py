"""
=============================================================================
Module: src.services.archive_service
Purpose: High-level media archival orchestration, deduplication, EXIF extraction & WebP thumbnails.
Used by: src.cli.verify_pipeline, src.cli.import_folder, FastAPI routes.
Dependencies: src.database.repository, src.storage.telegram_client, src.services.hasher,
              src.services.metadata_extractor, src.services.thumbnail_service, src.config
Public Members: ArchiveService
Side Effects: Database reads/writes, MTProto network uploads/downloads, local WebP file creation, audit logging.
=============================================================================
"""

import asyncio
from pathlib import Path
from typing import Any, Callable, Optional, Union
from telethon.errors import FloodWaitError
from src.config import get_settings
from src.database.repository import MediaRepository
from src.services.hasher import compute_bytes_sha256, compute_file_sha256
from src.services.metadata_extractor import extract_media_metadata
from src.services.thumbnail_service import generate_thumbnail
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client


class ArchiveService:
    r"""
    Orchestrates the entire archival flow:
    1. Computes local cryptographic SHA-256 hash.
    2. Performs O(log N) deduplication check in SQLite.
    3. Extracts EXIF and media technical metadata.
    4. Generates a local optimized WebP thumbnail.
    5. Uploads uncompressed raw document to Telegram storage channel with FloodWait defense.
    6. Records complete metadata in SQLite catalog and logs audit history.
    """

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

        target_channel = channel_id or self.settings.tg_channel_id
        if not target_channel:
            raise ValueError("Telegram channel ID is required for archiving.")

        # 1. Compute SHA-256 and byte size
        file_hash, file_size = compute_file_sha256(target_path)

        # 2. Check for deduplication in SQLite
        existing = await self.repository.get_by_hash(file_hash)
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

        # 5. Upload uncompressed document to Telegram with FloodWait retry safety
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

        telegram_file_id = None
        if message.document:
            telegram_file_id = str(message.document.id)

        # 6. Insert into SQLite catalog
        item_data = {
            "file_hash": file_hash,
            "file_name": target_path.name,
            "file_size": file_size,
            "mime_type": final_mime_type,
            "telegram_channel_id": int(str(target_channel).replace("-100", "")),
            "telegram_message_id": message.id,
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

        # 7. Record audit log
        await self.repository.log_audit(
            action="UPLOAD",
            media_id=media_id,
            file_hash=file_hash,
            details=f"Uploaded '{target_path.name}' ({file_size} bytes) to message {message.id}",
        )

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
            "telegram_message_id": message.id,
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
        Deletes media item from Telegram MTProto storage channel, local SQLite catalog,
        and local disk thumbnail cache.
        """
        media = await self.repository.get_by_id(media_id)
        if not media:
            raise ValueError(f"Media item with ID {media_id} not found in catalog.")

        # 1. Delete message from Telegram storage channel
        try:
            await self.telegram_client.delete_document(
                message_id=media["telegram_message_id"],
                channel_id=media["telegram_channel_id"],
            )
        except Exception as e:
            print(f"[Warning] Failed to delete message {media['telegram_message_id']} from Telegram: {e}")

        # 2. Delete local WebP thumbnail from disk if exists
        thumb_path = media.get("thumbnail_path")
        if thumb_path:
            p = Path(thumb_path)
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass

        # 3. Soft-delete from SQLite catalog
        await self.repository.delete_media(media_id)

        # 4. Record audit log
        await self.repository.log_audit(
            action="DELETE",
            media_id=media_id,
            file_hash=media["file_hash"],
            details=f"Deleted '{media['file_name']}' (Message ID: {media['telegram_message_id']})",
        )

        return {
            "status": "deleted",
            "media_id": media_id,
            "file_name": media["file_name"],
            "message": "Media permanently deleted from Telegram vault and catalog.",
        }
