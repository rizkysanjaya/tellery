"""
=============================================================================
Module: src.storage.__init__
Purpose: Storage subpackage initializer exporting MTProto Telegram client.
Used by: src.services.archive_service, src.cli
Dependencies: src.storage.telegram_client
Public Members: TelegramStorageClient, get_telegram_client
Side Effects: None
=============================================================================
"""

from src.storage.telegram_client import TelegramStorageClient, get_telegram_client

__all__ = ["TelegramStorageClient", "get_telegram_client"]
