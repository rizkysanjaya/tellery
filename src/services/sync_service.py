"""
=============================================================================
Module: src.services.sync_service
Purpose: Telegram Channel Ingestion, Manual Sync, and Real-time Live Message Ingest Engine.
         Indexes photos, videos, and raw documents sent directly to Telegram storage channels,
         extracting technical attributes, generating WebP thumbnails, and coordinating with
         ArchiveService to prevent in-flight duplicate ingestion.
Used by: src.api.routes.sync, src.api.app (lifespan background listener)
Dependencies: telethon, datetime, pathlib, src.database.repository, src.services.archive_service,
              src.services.thumbnail_service, src.storage.telegram_client, src.config
Public Members: SyncService, get_sync_service()
Side Effects: Downloads preview thumbnails from Telegram MTProto, generates WebP files in data/thumbnails/,
              writes rows to media_items and audit_logs in SQLite database.
=============================================================================
"""

import asyncio
from datetime import datetime, timezone
import hashlib
from pathlib import Path
from typing import Any, Optional, Union
from telethon import events
from telethon.tl.custom.message import Message
from telethon.tl.types import (
    DocumentAttributeFilename,
    DocumentAttributeImageSize,
    DocumentAttributeVideo,
    MessageMediaDocument,
    MessageMediaPhoto,
)
from src.config import get_settings
from src.database.repository import MediaRepository
from src.services.thumbnail_service import generate_thumbnail_from_bytes
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client


class SyncService:
    """
    Orchestrates Telegram Channel ingestion, history synchronization,
    and real-time live message indexing.
    """

    def __init__(
        self,
        repository: Optional[MediaRepository] = None,
        telegram_client: Optional[TelegramStorageClient] = None,
    ) -> None:
        self.repository = repository or MediaRepository()
        self.telegram_client = telegram_client or get_telegram_client()
        self.settings = get_settings()
        self._is_syncing = False
        self._last_sync_time: Optional[datetime] = None
        self._last_sync_stats: Optional[dict[str, Any]] = None
        self._listener_active = False
        self._sync_lock = asyncio.Lock()

    def get_status(self) -> dict[str, Any]:
        """Returns current sync status, listener health, and last sync timestamp."""
        return {
            "is_syncing": self._is_syncing,
            "listener_active": self._listener_active,
            "last_sync_time": self._last_sync_time.isoformat() if self._last_sync_time else None,
            "last_sync_stats": self._last_sync_stats,
        }

    async def ingest_telegram_message(
        self,
        message: Message,
        channel_id: Optional[Union[int, str]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Ingests a single Telegram message into the local media catalog if it contains media.
        Extracts technical attributes and creates a local WebP thumbnail.
        Returns the created/existing media item dictionary, or None if message has no media.
        """
        if not message.media:
            return None

        target_channel_id = channel_id or self.settings.tg_channel_id
        if isinstance(target_channel_id, str):
            try:
                target_channel_id = int(target_channel_id)
            except ValueError:
                pass

        # 1. Fast O(log N) check: Is this exact channel message already indexed or currently in flight?
        from src.services.archive_service import ArchiveService
        if ArchiveService.is_message_in_flight(message.id):
            return {"status": "skipped", "reason": "upload_in_flight", "item": None}

        if isinstance(target_channel_id, int):
            existing = await self.repository.get_by_channel_message(target_channel_id, message.id)
            if not existing:
                existing = await self.repository.get_by_message_id(message.id)
            if existing:
                return {"status": "skipped", "reason": "already_indexed", "item": existing}
        else:
            existing = await self.repository.get_by_message_id(message.id)
            if existing:
                return {"status": "skipped", "reason": "already_indexed", "item": existing}

        file_name = "untitled_media"
        mime_type = "application/octet-stream"
        file_size = 0
        width: Optional[int] = None
        height: Optional[int] = None
        duration_seconds: Optional[float] = None
        telegram_file_id: Optional[str] = None
        raw_hash_seed = f"{target_channel_id}_{message.id}"

        # 2. Extract metadata based on Telegram Media Type
        if isinstance(message.media, MessageMediaPhoto) and message.photo:
            photo = message.photo
            telegram_file_id = str(photo.id)
            date_str = message.date.strftime("%Y%m%d_%H%M%S") if message.date else "unknown"
            file_name = f"photo_{date_str}_{message.id}.jpg"
            mime_type = "image/jpeg"
            raw_hash_seed = f"photo_{target_channel_id}_{message.id}_{photo.id}"

            # Dimensions from largest photo size
            if hasattr(photo, "sizes") and photo.sizes:
                largest = photo.sizes[-1]
                if hasattr(largest, "w") and hasattr(largest, "h"):
                    width = largest.w
                    height = largest.h
                if hasattr(largest, "size"):
                    file_size = largest.size

        elif isinstance(message.media, MessageMediaDocument) and message.document:
            doc = message.document
            telegram_file_id = str(doc.id)
            file_size = doc.size
            mime_type = doc.mime_type or "application/octet-stream"
            raw_hash_seed = f"doc_{target_channel_id}_{message.id}_{doc.id}"

            # Extract Document Attributes (Filename, Video specs, Image specs)
            if hasattr(doc, "attributes") and doc.attributes:
                for attr in doc.attributes:
                    if isinstance(attr, DocumentAttributeFilename):
                        file_name = attr.file_name
                    elif isinstance(attr, DocumentAttributeVideo):
                        width = attr.w
                        height = attr.h
                        duration_seconds = float(attr.duration)
                    elif isinstance(attr, DocumentAttributeImageSize):
                        width = attr.w
                        height = attr.h

            if file_name == "untitled_media":
                ext = ".mp4" if mime_type.startswith("video/") else ".bin"
                if mime_type.startswith("image/"):
                    ext = ".jpg" if "jpeg" in mime_type else ".png"
                file_name = f"media_{message.id}{ext}"
        else:
            return None

        # Compute deterministic SHA-256 hash for database catalog indexing
        file_hash = hashlib.sha256(raw_hash_seed.encode("utf-8")).hexdigest()

        # Check if hash already exists (e.g. uploaded previously via web)
        existing_hash = await self.repository.get_by_hash(file_hash)
        if existing_hash:
            return {"status": "skipped", "reason": "duplicate_hash", "item": existing_hash}

        # 3. Generate Local WebP Thumbnail directly from Telegram preview bytes
        thumbnail_path: Optional[str] = None
        try:
            client = self.telegram_client.raw_client
            # Download smallest thumbnail preview in memory
            thumb_bytes = await client.download_media(message, thumb=-1, file=bytes)
            if thumb_bytes and isinstance(thumb_bytes, bytes) and len(thumb_bytes) > 0:
                thumbnail_path = generate_thumbnail_from_bytes(thumb_bytes, file_hash)
        except Exception as e:
            print(f"[SyncService] Could not generate direct Telegram thumbnail for msg {message.id}: {e}")

        # 4. Insert into SQLite Database
        item = {
            "file_hash": file_hash,
            "file_name": file_name,
            "file_size": file_size,
            "mime_type": mime_type,
            "telegram_channel_id": target_channel_id if isinstance(target_channel_id, int) else 0,
            "telegram_message_id": message.id,
            "telegram_file_id": telegram_file_id,
            "width": width,
            "height": height,
            "duration_seconds": duration_seconds,
            "camera_make": None,
            "camera_model": None,
            "date_taken": message.date.isoformat() if message.date else None,
            "thumbnail_path": thumbnail_path,
        }

        media_id = await self.repository.insert_media(item)
        item["id"] = media_id
        return {"status": "indexed", "item": item}

    async def sync_channel_history(
        self,
        channel_id: Optional[Union[int, str]] = None,
        limit: int = 200,
        full_scan: bool = False,
    ) -> dict[str, Any]:
        """
        Scans channel messages and indexes any uncataloged media items.
        Performs high-efficiency incremental scan (stops early after consecutive indexed items).
        """
        async with self._sync_lock:
            self._is_syncing = True
            target_channel = channel_id or self.settings.tg_channel_id

            stats = {
                "scanned": 0,
                "added": 0,
                "skipped": 0,
                "duration_seconds": 0.0,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            start_time = asyncio.get_event_loop().time()

            try:
                await self.telegram_client.start()
                channel_entity = await self.telegram_client.get_target_entity(target_channel)
                consecutive_indexed = 0

                active_ids = []
                async for message in self.telegram_client.raw_client.iter_messages(
                    channel_entity,
                    limit=limit,
                ):
                    active_ids.append(message.id)
                    if not message.media:
                        continue

                    stats["scanned"] += 1
                    res = await self.ingest_telegram_message(message, target_channel)

                    if res and res.get("status") == "indexed":
                        stats["added"] += 1
                        consecutive_indexed = 0
                    elif res and res.get("status") == "skipped":
                        stats["skipped"] += 1
                        consecutive_indexed += 1

                    # Incremental fast-path: stop if we hit 10 consecutive already-indexed items
                    if not full_scan and consecutive_indexed >= 10:
                        break

                # Deletion reconciliation: check cataloged messages in the scanned range
                if active_ids:
                    min_mid = min(active_ids)
                    max_mid = max(active_ids)
                    from src.database.connection import get_db_connection
                    async with get_db_connection() as conn:
                        async with conn.execute(
                            "SELECT id, telegram_message_id FROM media_items WHERE is_deleted = 0 AND (telegram_channel_id = ? OR telegram_channel_id = ?) AND telegram_message_id BETWEEN ? AND ?",
                            (target_channel, int(str(target_channel).replace("-100", "")), min_mid, max_mid),
                        ) as cursor:
                            db_items = await cursor.fetchall()

                        active_set = set(active_ids)
                        deleted_in_tg = [r[0] for r in db_items if r[1] not in active_set]
                        if deleted_in_tg:
                            placeholders = ",".join("?" for _ in deleted_in_tg)
                            await conn.execute(
                                f"UPDATE media_items SET is_deleted = 1 WHERE id IN ({placeholders})",
                                tuple(deleted_in_tg),
                            )
                            await conn.commit()
                            stats["reconciled_deleted"] = len(deleted_in_tg)
                            print(f"[SyncService] 🗑️ Reconciled {len(deleted_in_tg)} deleted items missing from Telegram")

            except Exception as e:
                print(f"[SyncService] Error during channel synchronization: {e}")
                stats["error"] = str(e)
            finally:
                stats["duration_seconds"] = round(asyncio.get_event_loop().time() - start_time, 2)
                self._is_syncing = False
                self._last_sync_time = datetime.now(timezone.utc)
                self._last_sync_stats = stats

            return stats

    async def setup_channel_live_listener(self) -> bool:
        """
        Registers async MTProto background event listeners for new channel messages and deletions.
        Whenever a user posts or deletes a photo/video directly in Telegram, TeleGallery
        automatically synchronizes the catalog in real-time.
        """
        try:
            await self.telegram_client.start()
            target_channel = self.settings.tg_channel_id
            channel_entity = await self.telegram_client.get_target_entity(target_channel)

            @self.telegram_client.raw_client.on(events.NewMessage(chats=channel_entity))
            async def on_new_channel_message(event):
                if event.message and event.message.media:
                    from src.services.archive_service import ArchiveService
                    if ArchiveService.is_message_in_flight(event.message.id):
                        return
                    try:
                        res = await self.ingest_telegram_message(event.message, target_channel)
                        if res and res.get("status") == "indexed":
                            item = res["item"]
                            print(f"[LiveSync] ⚡ Auto-ingested new media from Telegram: {item.get('file_name')} (ID: {item.get('id')})")
                    except Exception as err:
                        print(f"[LiveSync] Failed to auto-ingest message {event.message.id}: {err}")

            @self.telegram_client.raw_client.on(events.MessageDeleted(chats=channel_entity))
            async def on_channel_message_deleted(event):
                if event.deleted_ids:
                    try:
                        from src.database.connection import get_db_connection
                        async with get_db_connection() as conn:
                            placeholders = ",".join("?" for _ in event.deleted_ids)
                            await conn.execute(
                                f"UPDATE media_items SET is_deleted = 1 WHERE telegram_message_id IN ({placeholders}) AND is_deleted = 0",
                                tuple(event.deleted_ids),
                            )
                            await conn.commit()
                        print(f"[LiveSync] 🗑️ Auto-soft-deleted {len(event.deleted_ids)} items removed from Telegram channel: {event.deleted_ids}")
                    except Exception as err:
                        print(f"[LiveSync] Failed to process message deletion event: {err}")

            self._listener_active = True
            print(f"[LiveSync] ✅ Real-time Telegram Channel listener active for channel: {target_channel}")
            return True
        except Exception as e:
            print(f"[LiveSync] Failed to initialize live Telegram listener: {e}")
            self._listener_active = False
            return False


_sync_service_instance: Optional[SyncService] = None


def get_sync_service() -> SyncService:
    """Returns singleton instance of SyncService."""
    global _sync_service_instance
    if _sync_service_instance is None:
        _sync_service_instance = SyncService()
    return _sync_service_instance
