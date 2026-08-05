"""
=============================================================================
Module: src.database.repository
Purpose: Data access layer for media items catalog, timeline queries, and audit logging.
Used by: src.services.archive_service, src.cli.verify_pipeline, src.api.routes.media.
Dependencies: aiosqlite, src.database.connection
Public Members: MediaRepository
Side Effects: Executes SQL SELECT, INSERT, UPDATE statements against SQLite DB.
=============================================================================
"""

from typing import Any, Optional
import aiosqlite
from src.database.connection import get_db_connection


class MediaRepository:
    """Repository handling all database queries for media catalog, timeline feeds, and audit log."""

    @staticmethod
    async def get_by_hash(file_hash: str) -> Optional[dict[str, Any]]:
        """
        Retrieves active media item by cryptographic file hash.
        Cost: O(log N) point lookup via UNIQUE index idx_media_file_hash.
        """
        query = """
            SELECT id, file_hash, file_name, file_size, mime_type,
                   telegram_channel_id, telegram_message_id, telegram_file_id,
                   width, height, duration_seconds, camera_make, camera_model,
                   date_taken, thumbnail_path, created_at
            FROM media_items
            WHERE file_hash = ? AND is_deleted = 0
            LIMIT 1;
        """
        async with get_db_connection() as conn:
            async with conn.execute(query, (file_hash,)) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    @staticmethod
    async def get_by_id(media_id: int) -> Optional[dict[str, Any]]:
        """Retrieves media item by primary key."""
        query = """
            SELECT id, file_hash, file_name, file_size, mime_type,
                   telegram_channel_id, telegram_message_id, telegram_file_id,
                   width, height, duration_seconds, camera_make, camera_model,
                   date_taken, thumbnail_path, created_at
            FROM media_items
            WHERE id = ? AND is_deleted = 0
            LIMIT 1;
        """
        async with get_db_connection() as conn:
            async with conn.execute(query, (media_id,)) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    @staticmethod
    async def insert_media(item: dict[str, Any]) -> int:
        """
        Inserts new media record into the catalog and returns the new item ID.
        """
        query = """
            INSERT INTO media_items (
                file_hash, file_name, file_size, mime_type,
                telegram_channel_id, telegram_message_id, telegram_file_id,
                width, height, duration_seconds, camera_make, camera_model,
                date_taken, thumbnail_path
            ) VALUES (
                :file_hash, :file_name, :file_size, :mime_type,
                :telegram_channel_id, :telegram_message_id, :telegram_file_id,
                :width, :height, :duration_seconds, :camera_make, :camera_model,
                :date_taken, :thumbnail_path
            );
        """
        async with get_db_connection() as conn:
            cursor = await conn.execute(query, item)
            await conn.commit()
            return cursor.lastrowid or 0

    @staticmethod
    async def get_timeline(
        offset: int = 0,
        limit: int = 100,
        media_type: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> tuple[int, list[dict[str, Any]]]:
        """
        Retrieves paginated media items ordered chronologically along with the total count.
        Leverages idx_media_timeline index for minimum latency.
        """
        where_clauses = ["is_deleted = 0"]
        params: list[Any] = []

        if media_type == "photo":
            where_clauses.append("mime_type LIKE 'image/%'")
        elif media_type == "video":
            where_clauses.append("mime_type LIKE 'video/%'")

        if search_query:
            where_clauses.append("(file_name LIKE ? OR camera_make LIKE ? OR camera_model LIKE ?)")
            pattern = f"%{search_query}%"
            params.extend([pattern, pattern, pattern])

        where_sql = " AND ".join(where_clauses)

        count_query = f"SELECT COUNT(*) FROM media_items WHERE {where_sql};"
        fetch_query = f"""
            SELECT id, file_hash, file_name, file_size, mime_type,
                   telegram_channel_id, telegram_message_id, telegram_file_id,
                   width, height, duration_seconds, camera_make, camera_model,
                   date_taken, thumbnail_path, created_at,
                   strftime('%Y-%m', COALESCE(date_taken, created_at)) as period_key
            FROM media_items
            WHERE {where_sql}
            ORDER BY COALESCE(date_taken, created_at) DESC
            LIMIT ? OFFSET ?;
        """

        async with get_db_connection() as conn:
            # 1. Total count
            async with conn.execute(count_query, params) as cursor:
                total_row = await cursor.fetchone()
                total_count = total_row[0] if total_row else 0

            # 2. Fetch page items
            fetch_params = params + [limit, offset]
            async with conn.execute(fetch_query, fetch_params) as cursor:
                rows = await cursor.fetchall()
                items = [dict(r) for r in rows]

            return total_count, items

    @staticmethod
    async def get_stats() -> dict[str, Any]:
        """
        Retrieves aggregate statistics for the entire archive in a single pass.
        """
        query = """
            SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN mime_type LIKE 'image/%' THEN 1 ELSE 0 END) as total_photos,
                SUM(CASE WHEN mime_type LIKE 'video/%' THEN 1 ELSE 0 END) as total_videos,
                COALESCE(SUM(file_size), 0) as total_size_bytes
            FROM media_items
            WHERE is_deleted = 0;
        """
        async with get_db_connection() as conn:
            async with conn.execute(query) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else {
                    "total_items": 0,
                    "total_photos": 0,
                    "total_videos": 0,
                    "total_size_bytes": 0,
                }

    @staticmethod
    async def delete_media(media_id: int) -> bool:
        """
        Soft deletes media item from SQLite catalog.
        """
        query = "UPDATE media_items SET is_deleted = 1 WHERE id = ?;"
        async with get_db_connection() as conn:
            cursor = await conn.execute(query, (media_id,))
            await conn.commit()
            return cursor.rowcount > 0

    @staticmethod
    async def log_audit(
        action: str,
        media_id: Optional[int] = None,
        file_hash: Optional[str] = None,
        details: Optional[str] = None,
    ) -> None:
        """Records an action in the audit log for integrity tracking."""
        query = """
            INSERT INTO audit_logs (action, media_id, file_hash, details)
            VALUES (?, ?, ?, ?);
        """
        async with get_db_connection() as conn:
            await conn.execute(query, (action, media_id, file_hash, details))
            await conn.commit()
