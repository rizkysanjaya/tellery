"""
=============================================================================
Module: src.database.repository
Purpose: Data access layer for media catalog, folders/albums, and audit logging.
Used by: src.services.archive_service, src.api.routes.media, src.api.routes.folders.
Dependencies: aiosqlite, src.database.connection
Public Members: MediaRepository
Side Effects: Executes SQL SELECT, INSERT, UPDATE, DELETE statements on SQLite DB.
=============================================================================
"""

from typing import Any, Optional
import aiosqlite
from src.database.connection import get_db_connection


class MediaRepository:
    """Repository handling database queries for media catalog, folders, and audit log."""

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
        folder_id: Optional[int] = None,
    ) -> tuple[int, list[dict[str, Any]]]:
        """
        Retrieves paginated media items ordered chronologically along with the total count.
        Supports filtering by media type, search query, and virtual folder ID.
        """
        where_clauses = ["m.is_deleted = 0"]
        params: list[Any] = []

        if folder_id is not None:
            where_clauses.append("mf.folder_id = ?")
            params.append(folder_id)

        if media_type == "photo":
            where_clauses.append("m.mime_type LIKE 'image/%'")
        elif media_type == "video":
            where_clauses.append("m.mime_type LIKE 'video/%'")

        if search_query:
            where_clauses.append("(m.file_name LIKE ? OR m.camera_make LIKE ? OR m.camera_model LIKE ?)")
            pattern = f"%{search_query}%"
            params.extend([pattern, pattern, pattern])

        where_sql = " AND ".join(where_clauses)

        count_query = f"""
            SELECT COUNT(*) 
            FROM media_items m
            LEFT JOIN media_folders mf ON mf.media_id = m.id
            WHERE {where_sql};
        """
        fetch_query = f"""
            SELECT m.id, m.file_hash, m.file_name, m.file_size, m.mime_type,
                   m.telegram_channel_id, m.telegram_message_id, m.telegram_file_id,
                   m.width, m.height, m.duration_seconds, m.camera_make, m.camera_model,
                   m.date_taken, m.thumbnail_path, m.created_at,
                   strftime('%Y-%m', COALESCE(m.date_taken, m.created_at)) as period_key,
                   mf.folder_id as folder_id,
                   f.name as folder_name
            FROM media_items m
            LEFT JOIN media_folders mf ON mf.media_id = m.id
            LEFT JOIN folders f ON f.id = mf.folder_id
            WHERE {where_sql}
            ORDER BY COALESCE(m.date_taken, m.created_at) DESC
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
        """Soft deletes media item from SQLite catalog and removes folder associations."""
        query_soft_delete = "UPDATE media_items SET is_deleted = 1 WHERE id = ?;"
        query_clean_folders = "DELETE FROM media_folders WHERE media_id = ?;"
        async with get_db_connection() as conn:
            cursor = await conn.execute(query_soft_delete, (media_id,))
            await conn.execute(query_clean_folders, (media_id,))
            await conn.commit()
            return cursor.rowcount > 0

    # =========================================================================
    # Folder & Album Repository Methods
    # =========================================================================

    @staticmethod
    async def create_folder(name: str, parent_id: Optional[int] = None) -> int:
        """Creates a new folder / album and returns the folder ID."""
        query = "INSERT INTO folders (name, parent_id) VALUES (?, ?);"
        async with get_db_connection() as conn:
            cursor = await conn.execute(query, (name.strip(), parent_id))
            await conn.commit()
            return cursor.lastrowid or 0

    @staticmethod
    async def get_folder(folder_id: int) -> Optional[dict[str, Any]]:
        """Retrieves folder details by ID."""
        query = "SELECT id, name, parent_id, created_at FROM folders WHERE id = ?;"
        async with get_db_connection() as conn:
            async with conn.execute(query, (folder_id,)) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    @staticmethod
    async def list_folders() -> list[dict[str, Any]]:
        """
        Retrieves all folders along with their item count and latest cover thumbnail.
        Counts only active non-deleted items (COUNT(m.id)).
        """
        query = """
            SELECT 
                f.id, f.name, f.parent_id, f.created_at,
                COUNT(m.id) as item_count,
                (
                    SELECT m.thumbnail_path 
                    FROM media_items m 
                    JOIN media_folders sub_mf ON sub_mf.media_id = m.id 
                    WHERE sub_mf.folder_id = f.id AND m.is_deleted = 0 AND m.thumbnail_path IS NOT NULL
                    ORDER BY sub_mf.added_at DESC LIMIT 1
                ) as cover_thumbnail_path,
                (
                    SELECT m.id 
                    FROM media_items m 
                    JOIN media_folders sub_mf ON sub_mf.media_id = m.id 
                    WHERE sub_mf.folder_id = f.id AND m.is_deleted = 0 AND m.thumbnail_path IS NOT NULL
                    ORDER BY sub_mf.added_at DESC LIMIT 1
                ) as cover_media_id
            FROM folders f
            LEFT JOIN media_folders mf ON mf.folder_id = f.id
            LEFT JOIN media_items m ON m.id = mf.media_id AND m.is_deleted = 0
            GROUP BY f.id, f.name, f.parent_id, f.created_at
            ORDER BY f.created_at DESC;
        """
        async with get_db_connection() as conn:
            async with conn.execute(query) as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]

    @staticmethod
    async def delete_folder(folder_id: int) -> bool:
        """Deletes a folder; cascading foreign keys automatically remove folder associations."""
        query = "DELETE FROM folders WHERE id = ?;"
        async with get_db_connection() as conn:
            cursor = await conn.execute(query, (folder_id,))
            await conn.commit()
            return cursor.rowcount > 0

    @staticmethod
    async def add_media_to_folder(folder_id: int, media_ids: list[int]) -> int:
        """
        Moves media items to a folder (1-to-1 file manager relationship).
        Uses atomic INSERT OR REPLACE so a media item belongs to only 1 folder at a time.
        """
        if not media_ids:
            return 0
        query = "INSERT OR REPLACE INTO media_folders (folder_id, media_id) VALUES (?, ?);"
        params = [(folder_id, mid) for mid in media_ids]
        async with get_db_connection() as conn:
            cursor = await conn.executemany(query, params)
            await conn.commit()
            return cursor.rowcount

    @staticmethod
    async def remove_media_from_folder(folder_id: int, media_id: int) -> bool:
        """Removes a media item association from a folder."""
        query = "DELETE FROM media_folders WHERE folder_id = ? AND media_id = ?;"
        async with get_db_connection() as conn:
            cursor = await conn.execute(query, (folder_id, media_id))
            await conn.commit()
            return cursor.rowcount > 0

    @staticmethod
    async def get_media_folders(media_id: int) -> list[dict[str, Any]]:
        """Returns all folders that a specific media item is assigned to."""
        query = """
            SELECT f.id, f.name, f.parent_id, f.created_at, mf.added_at
            FROM folders f
            JOIN media_folders mf ON mf.folder_id = f.id
            WHERE mf.media_id = ?
            ORDER BY f.name ASC;
        """
        async with get_db_connection() as conn:
            async with conn.execute(query, (media_id,)) as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]

    @staticmethod
    async def update_thumbnail_path(media_id: int, thumbnail_path: str) -> bool:
        """Updates the thumbnail path for a specific media item."""
        query = "UPDATE media_items SET thumbnail_path = ? WHERE id = ?;"
        async with get_db_connection() as conn:
            cursor = await conn.execute(query, (thumbnail_path, media_id))
            await conn.commit()
            return cursor.rowcount > 0

    @staticmethod
    async def update_file_name(media_id: int, new_file_name: str) -> bool:
        """Updates the display filename for a specific media item."""
        query = "UPDATE media_items SET file_name = ? WHERE id = ? AND is_deleted = 0;"
        async with get_db_connection() as conn:
            cursor = await conn.execute(query, (new_file_name.strip(), media_id))
            await conn.commit()
            return cursor.rowcount > 0

    @staticmethod
    async def create_media_alias(existing_id: int, new_file_name: str) -> Optional[int]:
        """
        Creates a new catalog entry pointing to the same Telegram storage document
        and thumbnail with a new customized filename (zero additional storage).
        """
        existing = await MediaRepository.get_by_id(existing_id)
        if not existing:
            return None

        import time
        # Append unique alias tag to avoid SQLite unique constraint collision while preserving reference
        alias_hash = f"{existing['file_hash']}#alias{int(time.time() * 1000)}"

        query = """
            INSERT INTO media_items (
                file_hash, file_name, file_size, mime_type,
                telegram_channel_id, telegram_message_id, telegram_file_id,
                width, height, duration_seconds, camera_make, camera_model,
                date_taken, thumbnail_path
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?
            );
        """
        params = (
            alias_hash,
            new_file_name.strip(),
            existing["file_size"],
            existing["mime_type"],
            existing["telegram_channel_id"],
            existing["telegram_message_id"],
            existing["telegram_file_id"],
            existing.get("width"),
            existing.get("height"),
            existing.get("duration_seconds"),
            existing.get("camera_make"),
            existing.get("camera_model"),
            existing.get("date_taken"),
            existing.get("thumbnail_path"),
        )
        async with get_db_connection() as conn:
            cursor = await conn.execute(query, params)
            await conn.commit()
            return cursor.lastrowid

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
