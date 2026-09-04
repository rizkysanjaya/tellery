-- =============================================================================
-- File: src/database/schema.sql
-- Purpose: SQLite relational schema definition for TeleGallery catalog & albums/folders.
-- Used by: src.database.connection.init_db()
-- Dependencies: SQLite 3.35+
-- Optimizations: WAL mode, normalized layout, selective B-tree indices, cascading FKs.
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
    is_favorite INTEGER NOT NULL DEFAULT 0,   -- 1 if marked favorite, 0 otherwise
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_deleted INTEGER NOT NULL DEFAULT 0,    -- Soft delete flag (0 = active, 1 = in trash)
    deleted_at TEXT                           -- Timestamp when moved to trash
);

-- Indices for high-selectivity queries and $O(\log N)$ deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_file_hash 
    ON media_items(file_hash) 
    WHERE is_deleted = 0;

CREATE INDEX IF NOT EXISTS idx_media_timeline 
    ON media_items(COALESCE(date_taken, created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_media_favorite 
    ON media_items(is_favorite) 
    WHERE is_deleted = 0 AND is_favorite = 1;

CREATE INDEX IF NOT EXISTS idx_media_trash
    ON media_items(deleted_at DESC)
    WHERE is_deleted = 1;

CREATE INDEX IF NOT EXISTS idx_media_filename 
    ON media_items(file_name COLLATE NOCASE) 
    WHERE is_deleted = 0;

CREATE INDEX IF NOT EXISTS idx_media_filesize 
    ON media_items(file_size DESC) 
    WHERE is_deleted = 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_channel_msg_active 
    ON media_items(telegram_channel_id, telegram_message_id) 
    WHERE is_deleted = 0 AND file_hash NOT LIKE '%#alias%';

-- 2. Virtual Folders & Albums Table
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                       -- Folder / Album display name
    parent_id INTEGER,                        -- Nullable parent folder for nested hierarchies / collections
    color TEXT,                               -- Optional hex color for folder icon (e.g. '#6366f1')
    icon TEXT DEFAULT 'Folder',               -- Optional icon identifier (e.g. 'Folder', 'Heart', 'Star')
    is_favorite INTEGER NOT NULL DEFAULT 0,   -- 1 if pinned to favorites, 0 otherwise
    is_collection INTEGER NOT NULL DEFAULT 0, -- 1 if this acts as a parent collection group, 0 if standard album
    cover_media_id INTEGER,                   -- Custom pinned cover media item (NULL = default to latest added)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (cover_media_id) REFERENCES media_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

-- 3. Media <-> Folder Table (1-to-1: A media item belongs to at most 1 folder)
CREATE TABLE IF NOT EXISTS media_folders (
    media_id INTEGER NOT NULL PRIMARY KEY,
    folder_id INTEGER NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_folders_folder ON media_folders(folder_id, media_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_folders_single_media ON media_folders(media_id);

-- 4. Audit and Verification History Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,                     -- e.g. 'UPLOAD', 'DEDUP_HIT', 'DELETE', 'VERIFY_SUCCESS'
    media_id INTEGER,                         -- Nullable reference to media_items
    file_hash TEXT,
    details TEXT,                             -- Contextual JSON or description
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(media_id) REFERENCES media_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_media 
    ON audit_logs(media_id, action);
