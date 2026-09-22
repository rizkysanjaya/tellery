"""
=============================================================================
Module: src.storage.client_pool
Purpose: High-throughput multi-socket MTProto connection pool for Telegram.
         Manages a cluster of parallel TCP socket connections sharing the active
         authentication key to eliminate single-socket network latency bottlenecks.
Used by: src.storage.fast_upload, src.storage.telegram_client
Dependencies: asyncio, telethon, telethon.sessions.MemorySession, src.config
Public Members: TelegramConnectionPool, get_connection_pool()
Side Effects: Establishes concurrent TCP MTProto sockets to Telegram Data Centers.
=============================================================================
"""

import asyncio
from typing import List, Optional
from telethon import TelegramClient
from telethon.sessions import MemorySession
from src.config import get_settings


class TelegramConnectionPool:
    """
    Manages a pool of parallel MTProto TCP connections sharing the primary session auth key.
    """

    def __init__(self, pool_size: int = 4) -> None:
        self.pool_size = pool_size
        self._sub_clients: List[TelegramClient] = []
        self._lock = asyncio.Lock()
        self._initialized = False
        self._session_fingerprint: Optional[tuple] = None

    async def get_clients(self, main_client: TelegramClient) -> List[TelegramClient]:
        """
        Retrieves the active client pool, connecting sub-clients on demand.
        
        Args:
            main_client: Primary authenticated TelegramClient.
            
        Returns:
            List of TelegramClient instances (main_client + sub-clients) for concurrent requests.
        """
        async with self._lock:
            settings = get_settings()
            dc_id = main_client.session.dc_id
            server_address = main_client.session.server_address
            port = main_client.session.port
            auth_key = main_client.session.auth_key

            # Auth fingerprint to detect account/session/DC change
            auth_raw = getattr(auth_key, "key", None) or getattr(auth_key, "_key", None) or str(auth_key)
            fingerprint = (dc_id, server_address, port, auth_raw)

            # If session or DC changed, cleanly purge obsolete sub-clients
            if self._session_fingerprint != fingerprint:
                for sub in self._sub_clients:
                    try:
                        await asyncio.wait_for(sub.disconnect(), timeout=3.0)
                    except Exception:
                        pass
                self._sub_clients.clear()
                self._session_fingerprint = fingerprint

            # 1. Filter and reconnect existing sub-clients with bounded timeout
            healthy_sub_clients: List[TelegramClient] = []
            for sub in self._sub_clients:
                try:
                    if not sub.is_connected():
                        await asyncio.wait_for(sub.connect(), timeout=5.0)
                    if sub.is_connected():
                        healthy_sub_clients.append(sub)
                    else:
                        try:
                            await asyncio.wait_for(sub.disconnect(), timeout=3.0)
                        except Exception:
                            pass
                except Exception:
                    try:
                        await asyncio.wait_for(sub.disconnect(), timeout=3.0)
                    except Exception:
                        pass

            # 2. Replenish pool if any were dropped
            needed = self.pool_size - len(healthy_sub_clients)
            if needed > 0 and auth_key and dc_id:
                for _ in range(needed):
                    sub = None
                    try:
                        sess = MemorySession()
                        sess.set_dc(dc_id, server_address, port)
                        sess.auth_key = auth_key
                        sub = TelegramClient(sess, settings.tg_api_id, settings.tg_api_hash)
                        await asyncio.wait_for(sub.connect(), timeout=5.0)
                        if sub.is_connected():
                            healthy_sub_clients.append(sub)
                        else:
                            await asyncio.wait_for(sub.disconnect(), timeout=3.0)
                    except Exception as e:
                        if sub:
                            try:
                                await asyncio.wait_for(sub.disconnect(), timeout=3.0)
                            except Exception:
                                pass
                        print(f"[ClientPool] Note connecting sub-client: {e}")

            self._sub_clients = healthy_sub_clients
            self._initialized = True

            active_pool = [main_client] + [c for c in self._sub_clients if c.is_connected()]
            return active_pool if active_pool else [main_client]

    async def disconnect_all(self) -> None:
        """Gracefully disconnects all pooled helper clients."""
        async with self._lock:
            for sub in self._sub_clients:
                try:
                    await sub.disconnect()
                except Exception:
                    pass
            self._sub_clients.clear()
            self._initialized = False


_pool_instance: Optional[TelegramConnectionPool] = None


def get_connection_pool() -> TelegramConnectionPool:
    """Returns singleton TelegramConnectionPool instance."""
    global _pool_instance
    if _pool_instance is None:
        _pool_instance = TelegramConnectionPool(pool_size=4)
    return _pool_instance
