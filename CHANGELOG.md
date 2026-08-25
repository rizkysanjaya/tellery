# Changelog

All notable changes to the **TeleGallery Storage** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and Conventional Commits.

---

## [0.9.0] - 2026-09-01

### 🎨 Silk Cloud — Dark Neomorphic UI Redesign (from Stitch Vanguard Modern Gallery)
- **Neomorphic Visual Identity & Design Tokens (`tailwind.config.js`, `index.css`, `index.html`)**:
  - Implemented the "Silk Cloud" dark neomorphic aesthetic with deep navy palette (`bg-background: #0b1326`, `surface-base: #0f172a`, `surface-container: #171f33`).
  - Added utility classes for pure-shadow dual-tone depth: `.neo-raised`, `.neo-pressed`, `.neo-card`, `.neo-frame`, `.neo-image-wrapper`, `.neo-button`, and `.neo-button-primary`.
  - Migrated primary typography to **Plus Jakarta Sans** with a dedicated font scale (`headline-xl`, `headline-lg`, `headline-md`, `body-lg`, `body-md`, `body-sm`, `label-lg`, `label-md`).
- **Sidebar & Header Overhaul (`Sidebar.tsx`, `Header.tsx`, `AnimatedTabs.tsx`)**:
  - Brand header featuring glowing cloud emblem with `text-primary` gradient and "Silk Cloud / Media Vault" wordmark.
  - Active navigation items styled with `.neo-pressed` inset shadow on `bg-surface-base`.
  - Top search bar redesigned with inset `.neo-pressed` container and focused primary ring.
  - Neomorphic pill toggles for media type filtering and layout mode switcher.
- **Photo Grid & Card Frames (`MediaCard.tsx`, `TimelineGrid.tsx`)**:
  - Each photo card is hosted in a `.neo-frame` inset bezel with `.neo-image-wrapper` subtle drop shadows.
  - Date section headers in bold Plus Jakarta Sans with location labels and section-level select buttons.
- **Media Lightbox & Video Player (`MediaLightbox.tsx`, `VideoPlayer.tsx`)**:
  - Central photo canvas framed in a recessed neomorphic container with top navigation bar (Back arrow, Synced badge, Info toggle, More menu).
  - Integrated right-side metadata & action panel with neomorphic action pills (Download, Share, Favorite, Delete) and camera EXIF breakdown.
  - Video player redesigned with large circular `.neo-button` transport controls, inset timeline scrubber with indigo glow, and volume slider.
- **Utility Modals & Controls (`CommandPalette.tsx`, `FolderGrid.tsx`, `UploadManager.tsx`, `ContextMenu.tsx`, `SelectionToolbar.tsx`, `FloatingDock.tsx`, `AuroraBackground.tsx`)**:
  - Replaced flat dark glass surfaces across all dialogs, toolbars, and context menus with matching dark neomorphic cards and buttons.

---

## [0.8.0] - 2026-08-31

### 🚀 Telegram Channel Ingestion & Real-Time Auto-Ingest Engine
- **Live MTProto Event Listener (`src/services/sync_service.py`, `src/api/app.py`)**:
  - Implemented background MTProto event listener (`events.NewMessage`) active throughout FastAPI lifespan.
  - Automatically captures any photo, video, or raw document sent directly into the Telegram storage channel from mobile devices or Telegram Desktop, cataloging it into TeleGallery within seconds.
- **On-Demand & Incremental Channel Synchronization (`src/services/sync_service.py`, `src/api/routes/sync.py`)**:
  - Added high-speed channel history sync (`sync_channel_history`) with early-exit incremental scanning against SQLite `idx_media_channel_msg` index.
  - Generates instant WebP thumbnails in `data/thumbnails/` from Telegram preview bytes (`generate_thumbnail_from_bytes`) without needing full-file disk downloads.
  - Added REST endpoints `POST /api/sync` and `GET /api/sync/status`.
- **UI "Sync Vault" Controls (`Sidebar.tsx`, `CommandPalette.tsx`, `App.tsx`, `api.ts`)**:
  - Added one-click **Sync Vault** button in the Sidebar's Telegram Vault telemetry card with live spinning status indicator.
  - Added **Sync Vault from Telegram** command to the Raycast spotlight command palette (`Ctrl+K` / `⌘K`).
  - Seamlessly re-fetches gallery timeline and storage stats upon completion.

---

## [0.7.0] - 2026-08-31

### ✨ 21st.dev Motion Engine, 60fps Performance & Micro-Interactions
- **60fps / 120Hz GPU-Composited Rendering & Zero React Re-render Overhead**:
  - Refactored `VideoPlayer.tsx` to directly mutate progress bar, buffer bar, and timestamp DOM elements, eliminating React virtual DOM reconciliations on `timeupdate` (from 30-60 re-renders/sec down to **0 per second** during playback).
  - Removed full-viewport `backdrop-blur-3xl` shader from `MediaLightbox.tsx` to eliminate GPU compositor thrashing during active video playback.
  - Added FFmpeg stream probe fallback to `transcoder_service.py` to ensure accurate HEVC/H.265 detection and fast-start H.264 web compatibility.
  - Refactored `SpotlightCard.tsx` to mutate cursor spotlight overlay styles directly in the DOM, reducing React re-renders from hundreds per second down to **0 per second**.
  - Optimized `MediaCard.tsx` and `TimelineGrid.tsx` with hardware-accelerated CSS GPU transforms (`hover:-translate-y-1`, `translate3d`), completely eliminating layout thrashing (`getBoundingClientRect()` FLIP overhead).
  - Replaced CPU/GPU-taxing infinite blur JS animation loops in `AuroraBackground.tsx` with high-performance static GPU radial mesh gradients for stutter-free 4K/60fps video playback.
- **Sidebar Unlimited Telegram Cloud Vault (`Sidebar.tsx`)**:
  - Removed misleading progress bar implying a storage quota cap.
  - Added dedicated **Telegram Vault** telemetry card showcasing `∞ Unlimited` cloud storage badge, exact archived size (`GB`), photo/video counts, and live MTProto connection pulse.
- **Sliding Active Indicator Pills (`AnimatedTabs.tsx`, `Header.tsx`)**:
  - Replaced static tab borders with Framer Motion layout-synced sliding pill indicators (`layoutId="activeTabIndicator"`) with spring bounce physics.
  - Seamlessly morphs active state between Media Type filters (All / Photos / Videos) and Display Layout switchers (Grid / Dense / Masonry / List).
- **Raycast Spotlight Command Palette (`CommandPalette.tsx`, `App.tsx`, `Header.tsx`)**:
  - Global `Ctrl+K` / `⌘K` spotlight command palette with instant fuzzy search across all vault actions.
  - Direct navigation jump to Timeline, Albums Overview, individual Collections, view modes, and sorting configurations.
- **Apple / 21st.dev Magnetic Dynamic Dock (`FloatingDock.tsx`, `SelectionToolbar.tsx`)**:
  - Proximity magnification dock with continuous spring damping and mouse distance physics.
  - Floating dynamic island bulk selection dock with animated popovers and spring entrances.
- **Celebratory Confetti Micro-interaction (`UploadManager.tsx`)**:
  - Integrated celebratory `canvas-confetti` particle explosion upon completing all background upload tasks into Telegram Vault.

---

## [0.6.0] - 2026-08-31

### 🎨 Design & UI/UX (21st.dev Design Engineer Overhaul)
- **Ambient Glow Backdrop & Deep Dark Surfaces (`index.css`, `App.tsx`)**:
  - Replaced flat charcoal background with Zinc-950 and radial mesh gradient atmosphere (`.bg-ambient-glow`).
  - Added Electric Sky accent glow (`#0ea5e9` to `#38bdf8`) with soft diffusion rings and customized selection styles.
- **Raycast & Linear-Style Glass Sidebar (`Sidebar.tsx`)**:
  - Overhauled sidebar to dark glass surface (`bg-zinc-950/80 backdrop-blur-2xl border-r border-white/[0.06]`).
  - Live MTProto cloud telemetry banner with green pulse indicator and real-time storage quota bar with gradient fill.
  - Interactive collection navigation with active glow badges and dropzone drag highlights.
- **Spotlight Command Bar & Segmented Pills (`Header.tsx`)**:
  - Implemented 21st.dev command bar search input with `Ctrl+K` keycap badge and global keyboard shortcut listener.
  - Redesigned layout switcher and type filters with frosted glass segmented pills.
  - Added popover sort dropdown with checkmarks and active indicator badges.
- **Spring-Animated Media Cards & Masonry Items (`MediaCard.tsx`)**:
  - Refined hover lift animations (`hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:ring-1 hover:ring-sky-500/20`).
  - High-contrast frosted glass format badges (`JPG`, `PNG`, `WEBP`, `GIF`, `HEIC`, `MP4 • 0:34`) with monospace duration figures.
  - Polished selection checkboxes with subtle glow animations.
- **Structured Monospace List / Table View (`MediaListItem.tsx`)**:
  - Modern rounded glass row cards with hover highlights.
  - Monospace tabular figures for capture dates, dimensions, durations, and file sizes.
- **Floating Dynamic Island Selection Dock (`SelectionToolbar.tsx`)**:
  - Replaced rectangular toolbar with floating bottom Dynamic Island dock (`fixed bottom-7 left-1/2 -translate-x-1/2 bg-zinc-950/90 backdrop-blur-2xl border border-white/[0.12] ring-1 ring-white/5`).
  - Action pills for album assignment, permanent deletion, and quick deselection with `Esc` badge.
- **Cinema Studio Lightbox & Floating Upload Queue (`MediaLightbox.tsx`, `UploadManager.tsx`, `FolderGrid.tsx`)**:
  - Cinema studio darkroom lightbox with `backdrop-blur-3xl bg-black/95`, glass navigation arrows, and technical EXIF drawer.
  - Floating upload dock with glowing progress bars and live bytes telemetry.
  - Zero craft anti-patterns verified by Impeccable craft detector.

## [0.5.0] - 2026-08-31

### 🚀 Added
- **Multi-Layout Display Engine (`TimelineGrid.tsx`, `MediaListItem.tsx`, `Header.tsx`)**:
  - **Standard Responsive Grid (`grid`)**: Balanced square cards with play badge, duration, and hover details.
  - **Dense High-Capacity Grid (`dense`)**: Compact 6 to 10 column view for viewing hundreds of photos without endless scrolling.
  - **Natural Aspect Ratio Showcase (`masonry`)**: Multi-column masonry layout preserving true portrait and landscape aspect ratios without cropping.
  - **Detailed Table / List View (`list`)**: Structured table rows displaying thumbnail preview, filename, folder tags, date taken, dimension/duration specs, file size, and quick actions.
- **Interactive Sorting Engine (`Header.tsx`, `TimelineGrid.tsx`, `media.py`, `repository.py`)**:
  - Six sorting modes: Date Newest First, Date Oldest First, Name (A → Z), Name (Z → A), Size (Largest First), and Size (Smallest First).
  - Dynamic grouping: automatic chronological grouping by month, alphabetical grouping by initial letter, and size tier grouping.
  - Interactive clickable column headers in Table View (`Name`, `Date Taken`, `Size`) with ascending/descending arrow indicators.
  - Added B-tree indices on `media_items(file_name COLLATE NOCASE)` and `media_items(file_size DESC)` for instantaneous $O(\log N)$ sorting.
- **View Mode Switcher**: Quick-toggle icon bar in the top navigation header with persistent `localStorage` user memory.
- **Canvas Deselection**: Clicking on empty margins, timeline gutters, and background whitespace instantly clears active item selections.
- **Adaptive Context Submenus**: Dynamic screen-boundary detection flipping submenus leftwards and upwards to prevent viewport cutoff.

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
