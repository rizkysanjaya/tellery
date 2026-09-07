"""
=============================================================================
Module: src.database.connection
Purpose: Async SQLite connection lifecycle manager with WAL, PRAGMA tuning, and lightweight schema migrations.
Used by: src.database.repository, src.services, CLI scripts.
Dependencies: aiosqlite, src.config
Public Members: get_db_connection(), init_db()
Side Effects: Creates SQLite database file on disk, executes schema DDL, runs non-blocking column migrations.
=============================================================================
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
import aiosqlite
from src.config import get_settings


@asynccontextmanager
async def get_db_connection() -> AsyncIterator[aiosqlite.Connection]:
    """
    Yields an aiosqlite database connection configured with WAL journal mode,
    row factory for dictionary-like access, and foreign keys enabled.
    """
    settings = get_settings()
    db_path = settings.db_file_path

    async with aiosqlite.connect(db_path) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA journal_mode = WAL;")
        await conn.execute("PRAGMA synchronous = NORMAL;")
        await conn.execute("PRAGMA foreign_keys = ON;")
        await conn.execute("PRAGMA cache_size = -64000;")
        yield conn


async def init_db() -> None:
    """
    Initializes the database schema from schema.sql if not already initialized.
    """
    schema_path = Path(__file__).parent / "schema.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    # ---------- 1. Lightweight migrations for existing databases before index creation ----------
    async with get_db_connection() as conn:
        # folders table migrations
        cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='folders';")
        if await cursor.fetchone():
            cursor = await conn.execute("PRAGMA table_info(folders);")
            cols = [row[1] for row in await cursor.fetchall()]
            if "color" not in cols:
                await conn.execute("ALTER TABLE folders ADD COLUMN color TEXT;")
            if "icon" not in cols:
                await conn.execute("ALTER TABLE folders ADD COLUMN icon TEXT DEFAULT 'Folder';")
            if "is_favorite" not in cols:
                await conn.execute("ALTER TABLE folders ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;")
            if "is_collection" not in cols:
                await conn.execute("ALTER TABLE folders ADD COLUMN is_collection INTEGER NOT NULL DEFAULT 0;")
            if "cover_media_id" not in cols:
                await conn.execute("ALTER TABLE folders ADD COLUMN cover_media_id INTEGER REFERENCES media_items(id) ON DELETE SET NULL;")
            if "telegram_channel_id" not in cols:
                await conn.execute("ALTER TABLE folders ADD COLUMN telegram_channel_id INTEGER;")
                default_ch = get_settings().tg_channel_id
                if default_ch:
                    await conn.execute("UPDATE folders SET telegram_channel_id = ? WHERE telegram_channel_id IS NULL;", (default_ch,))

        # media_items table migrations
        cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='media_items';")
        if await cursor.fetchone():
            cursor = await conn.execute("PRAGMA table_info(media_items);")
            media_cols = [row[1] for row in await cursor.fetchall()]
            if "is_favorite" not in media_cols:
                await conn.execute("ALTER TABLE media_items ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;")
            if "deleted_at" not in media_cols:
                await conn.execute("ALTER TABLE media_items ADD COLUMN deleted_at TEXT;")
        await conn.commit()

    # ---------- 2. Execute schema.sql (tables and covered indexes) ----------
    async with get_db_connection() as conn:
        await conn.executescript(schema_sql)
        await conn.commit()

