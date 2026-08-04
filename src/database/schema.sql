-- =============================================================================
-- File: src/database/schema.sql
-- Purpose: SQLite relational schema definition for TeleGallery catalog.
-- Used by: src.database.connection.init_db()
-- Dependencies: SQLite 3.35+
-- Optimizations: WAL mode, normalized layout, selective B-tree indices.
-- Side Effects: Creates tables and indices in target SQLite database.
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -64000;

-- 1. Main Media Catalog Table
CREATE TABLE IF NOT EXISTS media_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_hash TEXT NOT NULL,                  -- SHA-256 hex digest for deduplication
    file_name TEXT NOT NULL,                  -- Original filename
    file_size INTEGER NOT NULL,               -- Size in bytes
    mime_type TEXT NOT NULL,                  -- e.g. image/jpeg, video/mp4
    telegram_channel_id INTEGER NOT NULL,     -- Telegram channel ID (-100...)
    telegram_message_id INTEGER NOT NULL,     -- Sequential message ID in channel
    telegram_file_id TEXT,                    -- MTProto document access identifier
    width INTEGER,                            -- Media pixel width
    height INTEGER,                           -- Media pixel height
    duration_seconds REAL,                    -- Duration in seconds for video/audio
    camera_make TEXT,                         -- Camera manufacturer (from EXIF)
    camera_model TEXT,                        -- Camera model (from EXIF)
    date_taken TEXT,                          -- ISO8601 capture timestamp (from EXIF)
    thumbnail_path TEXT,                      -- Relative path to cached WebP preview
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_deleted INTEGER NOT NULL DEFAULT 0     -- Soft delete flag
);

-- Indices for high-selectivity queries and $O(\log N)$ deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_file_hash 
    ON media_items(file_hash) 
    WHERE is_deleted = 0;

CREATE INDEX IF NOT EXISTS idx_media_timeline 
    ON media_items(COALESCE(date_taken, created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_media_channel_msg 
    ON media_items(telegram_channel_id, telegram_message_id);

-- 2. Audit and Verification History Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,                     -- e.g. 'UPLOAD', 'DEDUP_HIT', 'VERIFY_SUCCESS'
    media_id INTEGER,                         -- Nullable reference to media_items
    file_hash TEXT,
    details TEXT,                             -- Contextual JSON or description
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(media_id) REFERENCES media_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_media 
    ON audit_logs(media_id, action);
