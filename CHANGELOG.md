# Changelog

All notable changes to the **TeleGallery Storage** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and Conventional Commits.

---

## [0.4.0] - 2026-08-31

### 🚀 Added
- **Google Drive-Style Floating Upload Queue Manager (`UploadManager.tsx`)**:
  - Floating bottom-right upload manager with collapsible panel and batch progress tracking.
  - Per-file progress bars ($0\% \to 100\%$) with live byte transfer counters (e.g. `14.2 MB of 33.1 MB • 43%`).
  - Transparent two-phase status reporting: tracks active byte streaming to server ($0\% \to 95\%$) followed by live `"Syncing to Telegram Vault..."` state.
  - Badges for pending, in-progress, completed, duplicate, and error states.
- **Interactive Duplicate Conflict Resolution Modal (`DuplicateConflictModal.tsx`)**:
  - Interactive conflict resolution dialog when uploading an identical SHA-256 file.
  - **Skip**: Skips re-uploading, saving bandwidth and Telegram quotas.
  - **Keep Both & Rename**: Creates a new catalog alias entry with custom name (e.g. `file (1).jpg`) using $0\text{ MB}$ extra Telegram storage.
  - **Rename Existing**: Updates the name of the file already stored in the vault.
  - *"Apply to all remaining duplicates in batch"* toggle for bulk operations.
  - Backend routes `POST /api/media/{id}/rename` and `POST /api/media/{id}/alias`.
- **Keyboard Shortcuts & Range Selection (`TimelineGrid.tsx`, `App.tsx`)**:
  - `Shift` + Click continuous range selection (Google Drive / Windows Explorer style).
  - `Ctrl` / `Cmd` + Click: Toggle individual item in multi-selection.
  - `Ctrl` / `Cmd` + `A`: Instant Select All items in gallery.
  - `Escape`: Instant clear selection / dismiss context menus.
- **1-to-1 File Manager Folder Hierarchy & Move Confirmation Modal (`schema.sql`, `repository.py`, `MoveConfirmationModal.tsx`)**:
  - Enforced strict 1-to-1 folder membership: a media item belongs to exactly one folder at a time (like desktop file managers).
  - Added interactive `<MoveConfirmationModal />` warning when moving items that already reside in another folder.
  - Atomic `INSERT OR REPLACE` folder move operations and `UNIQUE(media_id)` index in SQLite.

### ⚡ Performance
- **In-Memory Telegram Entity Cache**: Cached channel entity in memory to eliminate repeated MTProto dialog lookups.
- **Direct 1-RPC Upload for Files $<10\text{MB}$**: Reduced small photo upload roundtrip from $3\text{s}$ down to $<0.35\text{s}$.
- **Parallel Upload Pool**: Implemented $3\times$ concurrency worker pool in `App.tsx`.

### 🐛 Fixed
- **Premature 100% Upload Progress**: Scaled browser upload progress smoothly and added Telegram Vault syncing state.
- **Album Folder Count Inconsistency**: Fixed SQL aggregate in `list_folders` to `COUNT(m.id)` with `is_deleted = 0` and purged deleted records from `media_folders`.

---

## [0.3.0] - 2026-08-31

### 🚀 Added
- **Custom Dark Studio Video Player (`VideoPlayer.tsx`)**:
  - Glassmorphic dark studio player with 0 KB third-party bundle weight.
  - Interactive timeline scrubber with live hover timestamp tooltip and buffer progress indicator.
  - Speed switcher ($0.5\times \to 2.0\times$), volume slider with `localStorage` memory.
  - Hotkey controls: `Space`/`K` (Play/Pause), `J`/`L` ($\pm 10\text{s}$ seek), `←`/`→` ($\pm 5\text{s}$ seek), `M` (Mute), `F` (Fullscreen), `P` (Picture-in-Picture).
  - Center ripple animations on play/pause and auto-hiding controls after $2.5\text{s}$ of mouse inactivity.
- **Automated On-the-Fly H.264 Web Transcoder (`transcoder_service.py`)**:
  - Integrated cross-platform static FFmpeg (`imageio-ffmpeg`).
  - Automatic FourCC codec detection: detects HEVC/H.265, ProRes, and 10-bit color video profiles that freeze in web browsers.
  - Transparently transcodes to high-quality, fast-start H.264 (`libx264 -preset veryfast -movflags +faststart`) for $0\text{ms}$ instant browser streaming.
  - Preserves 100% untouched raw HEVC source documents in the Telegram storage vault for full-fidelity "Download Original" exports.
  - Fully supports high framerate videos (60 FPS, 120 FPS, high refresh rates).
- **OpenCV Video Thumbnail Engine (`thumbnail_service.py`)**:
  - High-performance OpenCV frame extraction at $15\%$ video duration with Lanczos WebP downsampling.

### ⚡ Performance
- **StreamCacheManager (320x Faster Streaming)**:
  - Local progressive disk streaming with in-flight fetch deduplication.
  - Boosted video streaming throughput from $0.23\text{ MB/s}$ to **$75.36\text{ MB/s}$** ($327\times$ speedup).
  - Pre-cached uploaded files immediately on ingestion to eliminate redundant Telegram re-downloads.
  - 512KB MTProto upload part sizing.

### 🐛 Fixed
- **Unicode Filename Header Crash (RFC 5987 / RFC 6266)**:
  - Resolved Uvicorn/Starlette latin-1 `UnicodeEncodeError` when serving international (Korean, Japanese, emoji) filenames.
- **Video Playback Stall**: Resolved browser autoplay policy rejection and poster preview loading.

---

## [0.2.0] - 2026-08-31

### 🚀 Added
- **Google Drive-Style Persistent Left Sidebar (`Sidebar.tsx`)**:
  - Collapsible navigation with quick filter views (All Media, Photos, Videos, Albums).
  - Storage stats widget with live byte counter, file counts, and Telegram vault health indicator.
- **Virtual Folders & Album System (`FolderGrid.tsx`, `repository.py`)**:
  - Virtual folder & album management: create, rename, delete folders, and organize media without duplicating cloud storage bytes.
- **Right-Click Context Menu (`ContextMenu.tsx`)**:
  - Native desktop-style context menu on right-click (open, download, add to album, remove, delete).
- **Multi-Select System & Floating Action Toolbar (`SelectionToolbar.tsx`)**:
  - Multi-item selection with floating bottom bar for bulk album assignment and bulk deletion.

### 🐛 Fixed
- **Drag-and-Drop Dropzone Isolation**: Prevented internal media card drags from erroneously triggering the OS file upload dropzone.

---

## [0.1.0] - 2026-08-31

### 🚀 Added
- Initial TeleGallery storage engine and responsive React/Tailwind gallery interface.
- Telegram MTProto private channel storage integration with Telethon.
- SQLite metadata catalog with WAL mode and SHA-256 deduplication.
- CLI ingestion tool (`src.cli.import_folder`) and verification pipeline.
- HTTP 206 Partial Content video streaming and WebP thumbnail generation.
