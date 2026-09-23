"""
=============================================================================
Module: src.services.sync_service
Purpose: Telegram Channel Ingestion, Manual Sync (incremental & full-scan), and Real-time Live Message Ingest Engine.
         Indexes photos, videos, and raw documents sent directly to Telegram storage channels,
         extracting technical attributes, generating high-quality WebP thumbnails,
         canonicalizing channel IDs, trash-aware deduplication, and full/incremental deletion reconciliation.
         Equipped with resilient MTProto FloodWait backoff, offset-based pagination resumption,
         and strict media format whitelisting (preventing non-media/RAW file ingestion).
Used by: src.api.routes.sync, src.api.routes.vaults, src.api.app (lifespan background listener)
Dependencies: telethon, telethon.errors.FloodWaitError, datetime, pathlib,
              src.database.repository, src.database.connection,
              src.services.archive_service, src.services.thumbnail_service,
              src.storage.telegram_client, src.config
Public Members: SyncService, get_sync_service(), SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_VIDEO_EXTENSIONS, SUPPORTED_MEDIA_EXTENSIONS
Side Effects: Downloads preview thumbnails from Telegram MTProto,
              generates WebP files in .thumbnails/, writes rows to media_items and audit_logs in SQLite database.
=============================================================================
"""

import asyncio
from datetime import datetime, timezone
import hashlib
from pathlib import Path
from typing import Any, Optional, Union
from telethon import events
from telethon.errors import FloodWaitError
from telethon.tl.custom.message import Message
from telethon.tl.types import (
    DocumentAttributeFilename,
    DocumentAttributeImageSize,
    DocumentAttributeVideo,
    MessageMediaDocument,
    MessageMediaPhoto,
)
from src.config import get_settings
from src.database.connection import normalize_channel_id
from src.database.repository import MediaRepository
from src.services.thumbnail_service import generate_thumbnail_from_bytes
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client

# Strict Media Whitelists (Tellery v1 Core Specification)
# Only web-compatible media formats are ingested to prevent UI freezes and broken tiles.
SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic"}
SUPPORTED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".m4v"}
SUPPORTED_MEDIA_EXTENSIONS = SUPPORTED_IMAGE_EXTENSIONS | SUPPORTED_VIDEO_EXTENSIONS


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
        self._completed_origin_channels: set[int] = set()

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

        target_channel_id = normalize_channel_id(channel_id or self.settings.tg_channel_id)

        # 1. Fast O(log N) check: Is this exact channel message already indexed or currently in flight?
        from src.services.archive_service import ArchiveService
        if ArchiveService.is_message_in_flight(message.id):
            return {"status": "skipped", "reason": "upload_in_flight", "item": None}

        if isinstance(target_channel_id, int):
            existing = await self.repository.get_by_channel_message(target_channel_id, message.id, include_deleted=True)
        else:
            existing = await self.repository.get_by_message_id(message.id, include_deleted=True)

        if existing:
            if existing.get("is_deleted"):
                # Item is in Trash: do NOT duplicate or resurrect into active timeline!
                return {"status": "skipped", "reason": "in_trash", "item": existing}
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

        # Strict Whitelist Gatekeeper: Only ingest recognized standard photo and video formats.
        # Dropping unknown binary files, documents (.zip, .pdf, .apk), and camera RAW files (.RAF, .CR2, .NEF)
        # protects the database, avoids UI socket starvation, and guarantees 100% browser rendering compatibility.
        ext = Path(file_name).suffix.lower()
        if ext not in SUPPORTED_MEDIA_EXTENSIONS:
            return {"status": "skipped", "reason": "unsupported_extension", "file_name": file_name}

        # Normalize generic MIME types for whitelisted extensions
        if mime_type == "application/octet-stream":
            if ext in {".jpg", ".jpeg"}:
                mime_type = "image/jpeg"
            elif ext == ".png":
                mime_type = "image/png"
            elif ext == ".webp":
                mime_type = "image/webp"
            elif ext == ".gif":
                mime_type = "image/gif"
            elif ext == ".bmp":
                mime_type = "image/bmp"
            elif ext == ".heic":
                mime_type = "image/heic"
            elif ext in {".mp4", ".m4v"}:
                mime_type = "video/mp4"
            elif ext == ".webm":
                mime_type = "video/webm"
            elif ext == ".mov":
                mime_type = "video/quicktime"
            elif ext == ".mkv":
                mime_type = "video/x-matroska"

        # Compute deterministic SHA-256 hash for database catalog indexing
        file_hash = hashlib.sha256(raw_hash_seed.encode("utf-8")).hexdigest()

        # Check if hash already exists in target channel (e.g. uploaded previously via web or in trash)
        existing_hash = await self.repository.get_by_hash(file_hash, channel_id=target_channel_id, include_deleted=True)
        if existing_hash:
            if existing_hash.get("is_deleted"):
                return {"status": "skipped", "reason": "in_trash", "item": existing_hash}
            return {"status": "skipped", "reason": "duplicate_hash", "item": existing_hash}

        # 3. Generate Local WebP Thumbnail directly from Telegram preview bytes
        thumbnail_path: Optional[str] = None
        try:
            client = self.telegram_client.raw_client
            # Download full-resolution thumbnail preview in memory (PhotoSize, 320px/480px, NOT 30px stripped preview)
            thumb_bytes = await client.download_media(message, thumb=-1, file=bytes)
            if thumb_bytes and isinstance(thumb_bytes, bytes) and len(thumb_bytes) > 0:
                thumbnail_path = generate_thumbnail_from_bytes(thumb_bytes, file_hash)
        except FloodWaitError as e:
            wait_s = int(getattr(e, "seconds", 5)) + 2
            print(f"[SyncService] ⚠️ FloodWait ({wait_s}s) during thumbnail preview for msg {message.id}. Waiting before retry...")
            await asyncio.sleep(wait_s)
            try:
                thumb_bytes = await client.download_media(message, thumb=-1, file=bytes)
                if thumb_bytes and isinstance(thumb_bytes, bytes) and len(thumb_bytes) > 0:
                    thumbnail_path = generate_thumbnail_from_bytes(thumb_bytes, file_hash)
            except Exception as retry_err:
                print(f"[SyncService] Failed thumbnail retry for msg {message.id}: {retry_err}")
        except Exception as e:
            print(f"[SyncService] Could not generate direct Telegram thumbnail for msg {message.id}: {e}")

        # Extract dimensions from generated thumbnail if Telegram document attributes lacked them
        if thumbnail_path and (not width or not height):
            try:
                from PIL import Image
                with Image.open(thumbnail_path) as thumb_img:
                    width = thumb_img.width
                    height = thumb_img.height
            except Exception:
                pass

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
        limit: Optional[int] = None,
        full_scan: bool = False,
    ) -> dict[str, Any]:
        """
        Scans channel messages and indexes any uncataloged media items.
        Senior DBA Standard:
        - If limit is None: Scans without arbitrary truncation (supports 10,000+ items).
        - If channel has never been synced to inception (origin min_msg_id > 2), scans until origin.
        - If channel is already fully synced to origin and not full_scan, early-exits after 15 consecutive already-indexed items at or below max_msg_id.
        """
        async with self._sync_lock:
            self._is_syncing = True
            target_channel = channel_id
            if target_channel is None:
                from src.services.vault_service import get_vault_service
                target_channel = get_vault_service().get_active_channel_id() or self.settings.tg_channel_id
            target_channel = normalize_channel_id(target_channel)

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

                # Senior DBA: Check existing indexed bounds to determine if channel has historical gaps
                min_db_msg, max_db_msg = await self.repository.get_channel_message_bounds(target_channel)
                has_synced_to_origin = (
                    (min_db_msg is not None and min_db_msg <= 25)
                    or (target_channel in self._completed_origin_channels)
                )

                consecutive_indexed = 0
                hit_early_break = False
                active_ids = []
                current_offset_id = 0
                max_flood_retries = 5
                flood_retries = 0

                while True:
                    try:
                        remaining_limit = (limit - len(active_ids)) if limit is not None else None
                        if limit is not None and remaining_limit <= 0:
                            break

                        async for message in self.telegram_client.raw_client.iter_messages(
                            channel_entity,
                            limit=remaining_limit,
                            offset_id=current_offset_id,
                        ):
                            current_offset_id = message.id
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
                                if res.get("reason") == "already_indexed":
                                    consecutive_indexed += 1
                                else:
                                    consecutive_indexed = 0

                            # Micro-pause to prevent MTProto burst flood
                            await asyncio.sleep(0.02)

                            # Incremental fast-path: only stop early if:
                            # 1. full_scan is False
                            # 2. We hit 15 consecutive already-indexed items
                            # 3. Message ID is at or below max known ID in database
                            # 4. AND the channel has previously completed sync to its origin (no historical gaps!)
                            if not full_scan and has_synced_to_origin and consecutive_indexed >= 15:
                                if max_db_msg is not None and message.id <= max_db_msg:
                                    hit_early_break = True
                                    break

                        # Iterator finished normally or broke out due to early break
                        break

                    except FloodWaitError as e:
                        flood_retries += 1
                        wait_seconds = int(getattr(e, "seconds", 5)) + 2
                        print(
                            f"[SyncService] ⚠️ MTProto FloodWait encountered during sync "
                            f"(attempt {flood_retries}/{max_flood_retries}): waiting {wait_seconds}s..."
                        )
                        if flood_retries > max_flood_retries:
                            print(f"[SyncService] ❌ Exceeded max FloodWait retries ({max_flood_retries}). Stopping sync.")
                            stats["error"] = f"FloodWait limit exceeded: {e}"
                            break
                        await asyncio.sleep(wait_seconds)
                        print(f"[SyncService] 🔄 Resuming sync from offset_id={current_offset_id}...")
                        continue

                if not hit_early_break and limit is None:
                    self._completed_origin_channels.add(target_channel)

                # Deletion reconciliation: reconcile database items against scanned Telegram messages
                active_set = set(active_ids)
                from src.database.connection import get_db_connection
                async with get_db_connection() as conn:
                    # In a full scan or scan to origin (limit is None and not hit_early_break),
                    # active_set represents the complete universe of messages in the channel.
                    # Even if active_set is empty (0 messages in Telegram), all items in DB no longer exist in Telegram!
                    if not hit_early_break and limit is None:
                        async with conn.execute(
                            "SELECT id, telegram_message_id, file_hash, thumbnail_path FROM media_items WHERE (telegram_channel_id = ? OR telegram_channel_id = ?)",
                            (target_channel, int(str(target_channel).replace("-100", ""))),
                        ) as cursor:
                            db_items = await cursor.fetchall()
                    elif active_ids:
                        min_mid = min(active_ids)
                        async with conn.execute(
                            "SELECT id, telegram_message_id, file_hash, thumbnail_path FROM media_items WHERE (telegram_channel_id = ? OR telegram_channel_id = ?) AND telegram_message_id >= ?",
                            (target_channel, int(str(target_channel).replace("-100", "")), min_mid),
                        ) as cursor:
                            db_items = await cursor.fetchall()
                    else:
                        db_items = []

                    deleted_in_tg = [r for r in db_items if r["telegram_message_id"] not in active_set]
                    if deleted_in_tg:
                        from src.services.archive_service import ArchiveService
                        del_ids = [r["id"] for r in deleted_in_tg]
                        # 1. Purge database rows transactionally first
                        await self.repository.purge_media_batch_permanently(del_ids)
                        # 2. Clean up disk caches
                        for r in deleted_in_tg:
                            ArchiveService.cleanup_local_cache(r["file_hash"], r["thumbnail_path"])

                        stats["reconciled_deleted"] = len(del_ids)
                        print(f"[SyncService] 🗑️ Reconciled and permanently purged {len(del_ids)} deleted items missing from Telegram")

            except Exception as e:
                print(f"[SyncService] Error during channel synchronization: {e}")
                stats["error"] = str(e)
            finally:
                stats["duration_seconds"] = round(asyncio.get_event_loop().time() - start_time, 2)
                self._is_syncing = False
                self._last_sync_time = datetime.now(timezone.utc)
                self._last_sync_stats = stats

                # Trigger background thumbnail generation for any videos lacking embedded previews
                try:
                    from src.services.background_thumbnail_worker import get_thumbnail_worker
                    get_thumbnail_worker().trigger_scan()
                except Exception as w_err:
                    pass

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
                        from src.services.archive_service import ArchiveService
                        norm_ch = normalize_channel_id(target_channel)

                        all_deleted_rows: list[dict[str, Any]] = []
                        # Chunk message IDs by 100 to prevent SQL bind overflow
                        for i in range(0, len(event.deleted_ids), 100):
                            chunk_ids = event.deleted_ids[i:i + 100]
                            placeholders = ",".join("?" for _ in chunk_ids)
                            async with get_db_connection() as conn:
                                if norm_ch:
                                    query = f"SELECT id, file_hash, thumbnail_path FROM media_items WHERE (telegram_channel_id = ? OR telegram_channel_id = ?) AND telegram_message_id IN ({placeholders})"
                                    params = (norm_ch, int(str(norm_ch).replace("-100", "")), *chunk_ids)
                                else:
                                    query = f"SELECT id, file_hash, thumbnail_path FROM media_items WHERE telegram_message_id IN ({placeholders})"
                                    params = tuple(chunk_ids)
                                async with conn.execute(query, params) as cursor:
                                    rows = await cursor.fetchall()
                                    all_deleted_rows.extend(rows)

                        if all_deleted_rows:
                            del_ids = [r["id"] for r in all_deleted_rows]
                            # 1. Purge database records transactionally first
                            await self.repository.purge_media_batch_permanently(del_ids)
                            # 2. Safely unlink disk caches
                            for r in all_deleted_rows:
                                ArchiveService.cleanup_local_cache(r["file_hash"], r["thumbnail_path"])
                            print(f"[LiveSync] 🗑️ Permanently purged {len(del_ids)} items removed from Telegram channel: {event.deleted_ids}")
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
