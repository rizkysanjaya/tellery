"""
=============================================================================
Module: src.storage.tdlib_client
Purpose: High-performance C++ TDLib (Telegram Database Library) client wrapper.
         Provides asynchronous request/response correlation, background native
         event processing, and line-rate multi-threaded file downloading and streaming.
Used by: src.services.stream_cache, src.api.routes.stream, src.cli.tdlib_auth
Dependencies: tdjson, asyncio, threading, json, pathlib, src.config
Public Members: TDLibStorageClient, get_tdlib_client()
Side Effects: Executes native C++ TDLib binaries, manages data/tdlib/ database and cache files.
=============================================================================
"""

import asyncio
import json
import threading
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union
import tdjson
from src.config import get_settings


class TDLibStorageClient:
    """
    Asynchronous Python wrapper for Telegram's official C++ TDLib native library (tdjson).
    Uses a dedicated daemon thread for event polling and routes JSON responses to asyncio Futures.
    """

    def __init__(self, data_dir: Optional[Union[str, Path]] = None) -> None:
        self.settings = get_settings()
        self.data_dir = Path(data_dir or "data/tdlib")
        self.db_dir = self.data_dir / "db"
        self.files_dir = self.data_dir / "files"
        self.db_dir.mkdir(parents=True, exist_ok=True)
        self.files_dir.mkdir(parents=True, exist_ok=True)

        self.client_id: Optional[int] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._running = False
        self._receiver_thread: Optional[threading.Thread] = None

        self._pending_requests: Dict[str, asyncio.Future] = {}
        self._req_counter = 0
        self._lock = asyncio.Lock()

        self._auth_state: Optional[str] = None
        self._auth_state_event = asyncio.Event()
        self._event_handlers: List[Callable[[dict], Any]] = []

    def _generate_req_id(self) -> str:
        self._req_counter += 1
        return f"req_{self._req_counter}"

    async def start(self) -> None:
        """Initializes TDLib native instance and starts the background listener thread."""
        if self.client_id is not None:
            return

        self._loop = asyncio.get_running_loop()
        self.client_id = tdjson.td_create_client_id()

        # Suppress verbose native logs for clean console
        tdjson.td_execute(
            json.dumps({"@type": "setLogVerbosityLevel", "new_verbosity_level": 1}).encode("utf-8")
        )

        self._running = True
        self._receiver_thread = threading.Thread(
            target=self._receiver_worker, daemon=True, name="TDLib-Receiver"
        )
        self._receiver_thread.start()

        # Wake TDLib state machine and await ready or auth state
        await self._wake_and_wait_ready()

    def _receiver_worker(self) -> None:
        """Background thread worker that continuously receives raw JSON events from C++ TDLib."""
        while self._running:
            try:
                res = tdjson.td_receive(0.2)
                if res:
                    data = json.loads(res.decode("utf-8"))
                    if self._loop and not self._loop.is_closed():
                        self._loop.call_soon_threadsafe(self._dispatch_event, data)
            except Exception as e:
                print(f"[TDLib] Receiver thread error: {e}")

    def _dispatch_event(self, event: dict) -> None:
        """Dispatches an incoming TDLib event to pending futures or global listeners."""
        # Handle correlated request-response matching via @extra
        extra = event.get("@extra")
        if extra and extra in self._pending_requests:
            fut = self._pending_requests.pop(extra)
            if not fut.done():
                if event.get("@type") == "error":
                    fut.set_exception(
                        RuntimeError(f"TDLib Error {event.get('code')}: {event.get('message')}")
                    )
                else:
                    fut.set_result(event)

        # Handle authorization state updates
        ev_type = event.get("@type")
        if ev_type == "updateAuthorizationState":
            state_obj = event.get("authorization_state", {})
            self._auth_state = state_obj.get("@type")
            self._auth_state_event.set()

            if self._auth_state == "authorizationStateWaitTdlibParameters" and self.client_id:
                params = {
                    "@type": "setTdlibParameters",
                    "use_test_dc": False,
                    "database_directory": str(self.db_dir),
                    "files_directory": str(self.files_dir),
                    "use_file_database": True,
                    "use_chat_info_database": True,
                    "use_message_database": True,
                    "use_secret_chats": False,
                    "api_id": self.settings.tg_api_id,
                    "api_hash": self.settings.tg_api_hash,
                    "system_language_code": "en",
                    "device_model": "Desktop",
                    "system_version": "Windows",
                    "application_version": "1.0",
                    "enable_storage_optimizer": True,
                }
                tdjson.td_send(self.client_id, json.dumps(params).encode("utf-8"))
            elif self._auth_state == "authorizationStateWaitEncryptionKey" and self.client_id:
                tdjson.td_send(
                    self.client_id,
                    json.dumps({"@type": "checkDatabaseEncryptionKey", "encryption_key": ""}).encode("utf-8"),
                )

        # Notify registered event listeners
        for handler in self._event_handlers:
            try:
                handler(event)
            except Exception:
                pass

    async def _wake_and_wait_ready(self) -> None:
        """Kicks off TDLib state machine and waits for ready or phone prompt state."""
        if self.client_id is not None:
            tdjson.td_send(self.client_id, json.dumps({"@type": "getAuthorizationState"}).encode("utf-8"))
        
        for _ in range(300):
            if self._auth_state in [
                "authorizationStateWaitPhoneNumber",
                "authorizationStateWaitCode",
                "authorizationStateWaitPassword",
                "authorizationStateReady",
            ]:
                break
            await asyncio.sleep(0.05)

    async def send_request(self, request: dict) -> dict:
        """
        Sends a JSON request to the C++ TDLib client and awaits the correlated response.
        
        Args:
            request: TDLib API request dictionary.
            
        Returns:
            Correlated response dictionary from TDLib.
        """
        if self.client_id is None:
            await self.start()
        elif self._auth_state not in [
            "authorizationStateWaitPhoneNumber",
            "authorizationStateWaitCode",
            "authorizationStateWaitPassword",
            "authorizationStateReady",
        ]:
            await self._wake_and_wait_ready()

        req_id = self._generate_req_id()
        request["@extra"] = req_id

        fut = self._loop.create_future()
        self._pending_requests[req_id] = fut

        tdjson.td_send(self.client_id, json.dumps(request).encode("utf-8"))
        try:
            return await fut
        finally:
            self._pending_requests.pop(req_id, None)

    def add_event_handler(self, handler: Callable[[dict], Any]) -> None:
        """Registers a callback for incoming global TDLib updates."""
        self._event_handlers.append(handler)

    @property
    def auth_state(self) -> Optional[str]:
        """Returns the current TDLib authorization state."""
        return self._auth_state

    async def get_authorization_state(self) -> str:
        """Retrieves the current authorization state from the engine."""
        if self.client_id is None:
            await self.start()
        res = await self.send_request({"@type": "getAuthorizationState"})
        return res.get("@type", "unknown")

    async def set_phone_number(self, phone_number: str) -> dict:
        """Submits authentication phone number."""
        return await self.send_request({
            "@type": "setAuthenticationPhoneNumber",
            "phone_number": phone_number,
        })

    async def check_auth_code(self, code: str) -> dict:
        """Submits authentication code sent by Telegram."""
        return await self.send_request({
            "@type": "checkAuthenticationCode",
            "code": code,
        })

    async def check_password(self, password: str) -> dict:
        """Submits 2FA cloud password if enabled on account."""
        return await self.send_request({
            "@type": "checkAuthenticationPassword",
            "password": password,
        })

    async def download_file_fast(
        self,
        file_id: int,
        priority: int = 32,
        offset: int = 0,
        limit: int = 0,
        synchronous: bool = False,
    ) -> dict:
        """
        Requests C++ TDLib to download a file with 16 hardware streams into local disk.
        
        Args:
            file_id: TDLib file identifier.
            priority: Download priority (1-32, 32 = highest).
            offset: Byte offset to start download from.
            limit: Number of bytes to download (0 = entire file).
            synchronous: If True, blocks until download slice completes.
        """
        return await self.send_request({
            "@type": "downloadFile",
            "file_id": file_id,
            "priority": priority,
            "offset": offset,
            "limit": limit,
            "synchronous": synchronous,
        })

    async def upload_document(
        self,
        file_path: Union[str, Path],
        channel_id: Union[int, str],
        progress_callback: Optional[Callable[[int, int], None]] = None,
        timeout: float = 300.0,
    ) -> dict:
        """
        Uploads a local file to a Telegram channel as an uncompressed document using native C++ TDLib threads.
        
        Returns:
            dict with { 'id': telegram_message_id, 'file_id': telegram_file_id, 'raw_message': raw_td_message }
        """
        await self.start()
        if self._auth_state != "authorizationStateReady":
            raise RuntimeError(f"TDLib is not ready for uploads (State: {self._auth_state})")

        path_obj = Path(file_path).resolve()
        if not path_obj.exists():
            raise FileNotFoundError(f"File not found: {path_obj}")

        posix_path = path_obj.as_posix()
        total_size = path_obj.stat().st_size
        cid_raw = str(channel_id).lstrip("-").lstrip("100")
        chat_id = int(f"-100{cid_raw}")

        loop = asyncio.get_running_loop()
        upload_future: asyncio.Future = loop.create_future()
        temp_msg_id: Optional[int] = None

        def on_event(ev: dict) -> None:
            nonlocal temp_msg_id
            ev_type = ev.get("@type")
            if ev_type == "updateMessageSendSucceeded":
                old_id = ev.get("old_message_id")
                if temp_msg_id and old_id == temp_msg_id:
                    if not upload_future.done():
                        upload_future.set_result(ev.get("message"))
            elif ev_type == "updateMessageSendFailed":
                old_id = ev.get("old_message_id")
                if temp_msg_id and old_id == temp_msg_id:
                    if not upload_future.done():
                        err_msg = ev.get("error_message", "TDLib message send failed")
                        upload_future.set_exception(RuntimeError(err_msg))
            elif ev_type == "updateFile" and progress_callback:
                f_obj = ev.get("file", {})
                rem = f_obj.get("remote", {})
                if rem.get("is_uploading_active"):
                    uploaded = rem.get("uploaded_size", 0)
                    if uploaded > 0:
                        progress_callback(uploaded, total_size)

        self.add_event_handler(on_event)

        try:
            # Send document message via TDLib C++
            res = await self.send_request({
                "@type": "sendMessage",
                "chat_id": chat_id,
                "input_message_content": {
                    "@type": "inputMessageDocument",
                    "document": {
                        "@type": "inputDocument",
                        "document": {
                            "@type": "inputFileLocal",
                            "path": posix_path,
                        },
                    },
                },
            })

            temp_msg_id = res.get("id")
            if not temp_msg_id:
                raise RuntimeError(f"Failed to initiate TDLib upload: {res}")

            final_message = await asyncio.wait_for(upload_future, timeout=timeout)
            real_msg_id = final_message["id"] >> 20
            doc_info = final_message.get("content", {}).get("document", {}).get("document", {})

            if progress_callback:
                progress_callback(total_size, total_size)

            return {
                "id": real_msg_id,
                "td_msg_id": final_message["id"],
                "document_id": str(doc_info.get("id", "")),
                "file_name": path_obj.name,
                "file_size": total_size,
                "raw_message": final_message,
            }
        finally:
            if on_event in self._event_handlers:
                self._event_handlers.remove(on_event)

    async def close(self) -> None:
        """Gracefully shuts down the TDLib client instance."""
        if self.client_id is not None:
            try:
                await self.send_request({"@type": "close"})
            except Exception:
                pass
            self._running = False
            self.client_id = None


_tdlib_client_instance: Optional[TDLibStorageClient] = None


def get_tdlib_client() -> TDLibStorageClient:
    """Returns singleton instance of TDLibStorageClient."""
    global _tdlib_client_instance
    if _tdlib_client_instance is None:
        _tdlib_client_instance = TDLibStorageClient()
    return _tdlib_client_instance
