"""
=============================================================================
Module: src.services.vault_service
Purpose: Telegram Channel / Vault discovery, permission intelligence (Owner vs Viewer),
         owned-channel isolation harness, static & animated/video avatar caching,
         and active vault state management for seamless multi-channel gallery switching.
Used by: src.api.routes.vaults, src.api.routes.media, src.services.sync_service
Dependencies: telethon, pathlib, src.storage.telegram_client, src.database.repository, src.config
Public Members: VaultService, get_vault_service(), get_vault_by_id(), download_channel_avatar()
Side Effects: Calls Telegram MTProto get_dialogs(), download_profile_photo() & _download_photo(),
              writes avatar JPG and MP4 files to data/avatars/, queries SQLite database for channel stats.
=============================================================================
"""

import asyncio
import logging
from pathlib import Path
from typing import Any, Optional, Union
from telethon.tl.types import Channel, Chat, ChatAdminRights
from src.config import get_settings
from src.database.repository import MediaRepository
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client

logger = logging.getLogger(__name__)


class VaultService:
    """
    Manages multi-vault channel discovery, permissions analysis,
    and active vault state across the application lifecycle.
    """

    def __init__(
        self,
        telegram_client: Optional[TelegramStorageClient] = None,
        repository: Optional[MediaRepository] = None,
    ) -> None:
        self.telegram_client = telegram_client or get_telegram_client()
        self.repository = repository or MediaRepository()
        self.settings = get_settings()

        # Default active channel from environment / settings
        self._active_channel_id: Optional[int] = self.settings.tg_channel_id
        self._cached_vaults: list[dict[str, Any]] = []
        self._permissions_cache: dict[int, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    def get_vault_by_id(self, channel_id: int) -> Optional[dict[str, Any]]:
        """Returns cached metadata for a specific vault by ID or raw ID."""
        for v in self._cached_vaults:
            if v["id"] == channel_id or v.get("raw_id") == abs(channel_id):
                return v
        return None

    async def download_channel_avatar(self, channel_id: int) -> dict[str, Optional[str]]:
        """
        Downloads and caches profile avatar for a specific Telegram channel.
        Supports both static image (.jpg) and animated video avatar (.mp4) if available.
        Saves to data/avatars/channel_avatar_{abs_id}.jpg and .mp4.
        """
        avatar_dir = Path("data/avatars")
        avatar_dir.mkdir(parents=True, exist_ok=True)
        avatar_file = avatar_dir / f"channel_avatar_{abs(channel_id)}.jpg"
        avatar_video_file = avatar_dir / f"channel_avatar_{abs(channel_id)}.mp4"

        result = {
            "photo": str(avatar_file) if avatar_file.exists() else None,
            "video": str(avatar_video_file) if avatar_video_file.exists() else None,
        }

        # If both are cached, return immediately
        if result["photo"] and result["video"]:
            return result

        try:
            await self.telegram_client.start()
            raw_client = self.telegram_client.raw_client
            entity = await self.telegram_client.get_target_entity(channel_id)
            if entity:
                # 1. Download static snapshot if missing
                if not avatar_file.exists():
                    try:
                        res = await raw_client.download_profile_photo(entity, file=str(avatar_file))
                        if res and avatar_file.exists():
                            result["photo"] = str(avatar_file)
                    except Exception as e:
                        logger.debug("Failed downloading static avatar for channel %s: %s", channel_id, e)

                # 2. Check and download animated / video avatar if present
                photo_obj = getattr(entity, "photo", None)
                if getattr(photo_obj, "has_video", False) and not avatar_video_file.exists():
                    try:
                        from telethon.tl.functions.channels import GetFullChannelRequest
                        full = await raw_client(GetFullChannelRequest(entity))
                        chat_photo = getattr(getattr(full, "full_chat", None), "chat_photo", None)
                        if chat_photo and getattr(chat_photo, "video_sizes", None):
                            v_res = await raw_client._download_photo(
                                chat_photo, file=str(avatar_video_file), date=None, thumb=-1, progress_callback=None
                            )
                            if v_res and avatar_video_file.exists():
                                result["video"] = str(avatar_video_file)
                                logger.info("Successfully downloaded animated video avatar for channel %s", channel_id)
                    except Exception as e:
                        logger.debug("Failed downloading video avatar for channel %s: %s", channel_id, e)

        except Exception as e:
            logger.debug("Failed to download avatar for channel %s: %s", channel_id, e)

        return result

    def get_active_channel_id(self) -> Optional[int]:
        """Returns the currently active Telegram channel ID."""
        return self._active_channel_id

    def set_active_channel_id(self, channel_id: int) -> None:
        """Sets the currently active Telegram channel ID."""
        self._active_channel_id = channel_id
        logger.info("Active vault switched to channel_id: %s", channel_id)

    async def get_vault_permissions(self, channel_id: int) -> dict[str, Any]:
        """
        Returns permission metadata for a specific channel.
        Cached for sub-millisecond route validation.
        """
        if channel_id in self._permissions_cache:
            return self._permissions_cache[channel_id]

        # Trigger discovery to refresh permission cache
        await self.discover_vaults()
        return self._permissions_cache.get(
            channel_id,
            {
                "role": "viewer",
                "can_upload": False,
                "can_delete": False,
                "is_creator": False,
                "is_admin": False,
            },
        )

    async def is_vault_writable(self, channel_id: Optional[int] = None) -> bool:
        """
        Checks if the target or active channel allows write actions (upload, delete, edit).
        Returns True if user is owner/creator or admin with posting rights.
        """
        target_id = channel_id if channel_id is not None else self._active_channel_id
        if target_id is None:
            return False
        perms = await self.get_vault_permissions(target_id)
        return bool(perms.get("can_upload", False))

    async def discover_vaults(self, force_refresh: bool = False) -> list[dict[str, Any]]:
        """
        Discovers all Telegram channels and supergroups accessible to the user,
        evaluates administrative permissions, and joins with local SQLite storage stats.
        """
        async with self._lock:
            if self._cached_vaults and not force_refresh:
                # Refresh storage stats dynamically
                updated = []
                for v in self._cached_vaults:
                    v_id = v["id"]
                    stats = await self.repository.get_stats(channel_id=v_id)
                    v_copy = dict(v)
                    v_copy["media_count"] = stats.get("total_items", 0)
                    v_copy["total_size_bytes"] = stats.get("total_size_bytes", 0)
                    v_copy["is_active"] = (v_id == self._active_channel_id)
                    updated.append(v_copy)
                return updated

            try:
                await self.telegram_client.start()
                tc = self.telegram_client.raw_client
                me = await tc.get_me()
                dialogs = await tc.get_dialogs(limit=100)

                discovered = []
                for d in dialogs:
                    entity = d.entity
                    if isinstance(entity, Channel):
                        is_creator = getattr(entity, "creator", False)
                        admin_rights = getattr(entity, "admin_rights", None)
                        is_admin = bool(admin_rights)

                        # Can user post media?
                        can_post = is_creator
                        if admin_rights:
                            if isinstance(admin_rights, ChatAdminRights):
                                can_post = can_post or bool(admin_rights.post_messages) or bool(admin_rights.change_info)
                            else:
                                can_post = True

                        can_delete = is_creator or (is_admin and getattr(admin_rights, "delete_messages", False))
                        role = "owner" if (is_creator or (is_admin and can_post)) else "viewer"

                        # Harness: Only list channels the user owns or administers with upload capabilities
                        if role != "owner":
                            continue

                        full_id = d.id
                        if self.settings.tg_channel_id and (
                            d.id == self.settings.tg_channel_id
                            or entity.id == abs(self.settings.tg_channel_id)
                            or str(self.settings.tg_channel_id).endswith(str(entity.id))
                        ):
                            full_id = self.settings.tg_channel_id

                        stats = await self.repository.get_stats(channel_id=full_id)

                        vault_entry = {
                            "id": full_id,
                            "raw_id": entity.id,
                            "title": entity.title or "Untitled Channel",
                            "username": getattr(entity, "username", None),
                            "role": role,
                            "can_upload": can_post,
                            "can_delete": can_delete,
                            "is_creator": is_creator,
                            "is_admin": is_admin,
                            "broadcast": getattr(entity, "broadcast", False),
                            "megagroup": getattr(entity, "megagroup", False),
                            "is_active": (full_id == self._active_channel_id),
                            "media_count": stats.get("total_items", 0),
                            "total_size_bytes": stats.get("total_size_bytes", 0),
                        }
                        discovered.append(vault_entry)
                        self._permissions_cache[full_id] = {
                            "role": role,
                            "can_upload": can_post,
                            "can_delete": can_delete,
                            "is_creator": is_creator,
                            "is_admin": is_admin,
                        }

                # Ensure active vault is set if not already selected
                if self._active_channel_id is None and discovered:
                    self._active_channel_id = discovered[0]["id"]
                    discovered[0]["is_active"] = True

                self._cached_vaults = discovered
                logger.info("Discovered %d Telegram vaults/channels.", len(discovered))
                return discovered

            except Exception as e:
                logger.error("Failed to discover Telegram vaults: %s", e)
                # Fallback to configured settings channel if MTProto discovery fails
                if self.settings.tg_channel_id:
                    fb_id = self.settings.tg_channel_id
                    fb_stats = await self.repository.get_stats(channel_id=fb_id)
                    fallback_vault = {
                        "id": fb_id,
                        "raw_id": abs(fb_id),
                        "title": "Primary Telegram Vault",
                        "username": None,
                        "role": "owner",
                        "can_upload": True,
                        "can_delete": True,
                        "is_creator": True,
                        "is_admin": True,
                        "broadcast": True,
                        "megagroup": False,
                        "is_active": True,
                        "media_count": fb_stats.get("total_items", 0),
                        "total_size_bytes": fb_stats.get("total_size_bytes", 0),
                    }
                    self._permissions_cache[fb_id] = {
                        "role": "owner",
                        "can_upload": True,
                        "can_delete": True,
                        "is_creator": True,
                        "is_admin": True,
                    }
                    return [fallback_vault]
                return []


# Global Singleton instance
_vault_service_instance: Optional[VaultService] = None


def get_vault_service() -> VaultService:
    """Returns the singleton VaultService instance."""
    global _vault_service_instance
    if _vault_service_instance is None:
        _vault_service_instance = VaultService()
    return _vault_service_instance
