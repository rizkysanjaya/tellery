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

    async def get_clients(self, main_client: TelegramClient) -> List[TelegramClient]:
        """
        Retrieves the active client pool, connecting sub-clients on demand.
        
        Args:
            main_client: Primary authenticated TelegramClient.
            
        Returns:
            List of TelegramClient instances (main_client + sub-clients) for concurrent requests.
        """
        async with self._lock:
            if not self._initialized:
                try:
                    settings = get_settings()
                    dc_id = main_client.session.dc_id
                    server_address = main_client.session.server_address
                    port = main_client.session.port
                    auth_key = main_client.session.auth_key

                    for _ in range(self.pool_size):
                        sess = MemorySession()
                        sess.set_dc(dc_id, server_address, port)
                        sess.auth_key = auth_key
                        sub = TelegramClient(sess, settings.tg_api_id, settings.tg_api_hash)
                        await sub.connect()
                        self._sub_clients.append(sub)

                    self._initialized = True
                except Exception as e:
                    print(f"[ClientPool] Warning initializing sub-clients: {e}")
                    return [main_client]

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
