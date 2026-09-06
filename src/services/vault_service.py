"""
=============================================================================
Module: src.services.vault_service
Purpose: Telegram Channel / Vault discovery, permission intelligence (Owner vs Viewer),
         and active vault state management for multi-channel library switching.
Used by: src.api.routes.vaults, src.api.routes.media, src.services.sync_service
Dependencies: telethon, src.storage.telegram_client, src.database.repository, src.config
Public Members: VaultService, get_vault_service()
Side Effects: Calls Telegram MTProto get_dialogs(), queries SQLite database for channel stats.
=============================================================================
"""

import asyncio
import logging
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
