"""
=============================================================================
Module: src.storage.telegram_client
Purpose: Telegram MTProto Client wrapper for raw document storage & chunked streaming.
Used by: src.services.archive_service, src.cli.verify_pipeline
Dependencies: telethon, src.config
Public Members: TelegramStorageClient, get_telegram_client()
Side Effects: Network MTProto calls to Telegram servers, reads/writes session file.
=============================================================================
"""

import io
from pathlib import Path
from typing import AsyncIterator, Callable, Optional, Union
from telethon import TelegramClient
from telethon.tl.custom.message import Message
from telethon.tl.types import Document, MessageMediaDocument
from src.config import get_settings


class TelegramStorageClient:
    """
    Manages Telegram MTProto connection and handles raw document upload/download.
    Forces document transfer mode to eliminate any lossy server-side compression.
    """

    def __init__(
        self,
        api_id: Optional[int] = None,
        api_hash: Optional[str] = None,
        session_name: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        self.api_id = api_id or settings.tg_api_id
        self.api_hash = api_hash or settings.tg_api_hash
        self.session_name = session_name or settings.tg_session_name

        if not self.api_id or not self.api_hash:
            raise ValueError(
                "Telegram API_ID and API_HASH are required. "
                "Please configure them in your .env file or environment."
            )

        # Store session in data directory
        session_path = Path("data") / self.session_name
        session_path.parent.mkdir(parents=True, exist_ok=True)

        self._client = TelegramClient(str(session_path), self.api_id, self.api_hash)
        self._is_started = False

    async def start(self) -> None:
        """Starts client session, prompting for phone/code if not yet authorized."""
        if not self._is_started:
            await self._client.start()
            self._is_started = True

    async def stop(self) -> None:
        """Disconnects client session cleanly."""
        if self._is_started and self._client.is_connected():
            await self._client.disconnect()
            self._is_started = False

    async def __aenter__(self) -> "TelegramStorageClient":
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.stop()

    async def get_target_entity(self, channel_id: Union[int, str]):
        """
        Resolves Telegram entity (channel/group/chat/user) safely, ensuring
        access_hash is populated in MTProto session cache.
        """
        await self.start()

        # 1. Try get_entity with given identifier
        try:
            return await self._client.get_entity(channel_id)
        except Exception:
            pass

        # 2. Try normalized variants for integer channel IDs
        if isinstance(channel_id, int):
            abs_id = abs(channel_id)
            for candidate in [int(f"-100{abs_id}"), -abs_id, abs_id]:
                try:
                    return await self._client.get_entity(candidate)
                except Exception:
                    pass

        # 3. Match from active dialogs
        try:
            dialogs = await self._client.get_dialogs(limit=200)
            target_str = str(channel_id).replace("-100", "").replace("-", "")
            for d in dialogs:
                d_id_str = str(d.id).replace("-100", "").replace("-", "")
                if d_id_str == target_str or str(d.id) == str(channel_id) or d.name == str(channel_id):
                    return d.entity
        except Exception:
            pass

        # 4. Fallback to get_input_entity
        return await self._client.get_input_entity(channel_id)

    async def upload_document(
        self,
        file_path: Union[str, Path],
        channel_id: Union[int, str],
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> Message:
        """
        Uploads a local file to the private Telegram channel as an uncompressed raw document.

        Args:
            file_path: Path to the local file.
            channel_id: Target channel ID (e.g. -100xxxxxxxxxx) or username.
            progress_callback: Optional callback(current_bytes, total_bytes).

        Returns:
            Message: The uploaded Telegram message object containing Document media.
        """
        await self.start()
        entity = await self.get_target_entity(channel_id)
        path_obj = Path(file_path)

        message = await self._client.send_file(
            entity=entity,
            file=str(path_obj),
            force_document=True,  # CRITICAL: Ensures bit-for-bit uncompressed document
            progress_callback=progress_callback,
            silent=True,  # Upload without sending noisy push alerts
        )
        return message

    async def download_document_bytes(
        self,
        message_id: int,
        channel_id: Union[int, str],
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> bytes:
        """
        Downloads a document from Telegram directly into an in-memory byte buffer.

        Args:
            message_id: Message ID containing the document.
            channel_id: Storage channel ID.
            progress_callback: Optional callback(current_bytes, total_bytes).

        Returns:
            bytes: The exact raw file content.
        """
        await self.start()
        entity = await self.get_target_entity(channel_id)
        message = await self._client.get_messages(entity, ids=message_id)
        if not message or not message.media:
            raise ValueError(f"No media document found in message {message_id} in channel {channel_id}")

        buffer = io.BytesIO()
        await self._client.download_media(
            message.media,
            file=buffer,
            progress_callback=progress_callback,
        )
        return buffer.getvalue()

    async def iter_document_chunks(
        self,
        message_id: int,
        channel_id: Union[int, str],
        offset: int = 0,
        limit: Optional[int] = None,
        chunk_size: int = 128 * 1024,
    ) -> AsyncIterator[bytes]:
        """
        Streams document chunks directly from Telegram MTProto servers.
        Used for HTTP 206 Partial Content video seeking without whole-file download.

        Args:
            message_id: Telegram message ID.
            channel_id: Target channel ID.
            offset: Byte offset to start streaming from.
            limit: Maximum number of bytes to stream (None for until EOF).
            chunk_size: MTProto chunk read size (default 128KB).
        """
        await self.start()
        entity = await self.get_target_entity(channel_id)
        message = await self._client.get_messages(entity, ids=message_id)
        if not message or not message.media:
            raise ValueError(f"No media found for message {message_id}")

        async for chunk in self._client.iter_download(
            message.media,
            offset=offset,
            limit=limit,
            chunk_size=chunk_size,
        ):
            yield chunk


_client_instance: Optional[TelegramStorageClient] = None


def get_telegram_client() -> TelegramStorageClient:
    """Returns singleton TelegramStorageClient instance configured from settings."""
    global _client_instance
    if _client_instance is None:
        _client_instance = TelegramStorageClient()
    return _client_instance
