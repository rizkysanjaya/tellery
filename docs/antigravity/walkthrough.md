# Walkthrough: Multi-Channel Upload Isolation, Sync Limit, & High-Res Thumbnails

## 1. Problem Summary & Root Cause (Previous Fix)

The user reported that uploading items to a **new channel created directly via Tellery** failed to display the newly uploaded media in the timeline, while existing channels worked fine.

### Root Cause Analysis

1. **Cross-Channel Message ID Collision in `MediaRepository.insert_media`**:
   - Telegram message IDs are sequential numbers starting from `1, 2, 3...` within each individual channel.
   - When a user uploads to a brand-new channel, Telegram assigns message ID `1` or `2`.
   - In [`src/database/repository.py`](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/database/repository.py), `insert_media` checked for existing messages with `telegram_message_id = ?` without scoping by `telegram_channel_id`.
   - Consequently, zero rows were inserted for the new Tellery vault (`-1003986300298`), and the timeline showed 0 items.

2. **Global Hash Collision in `ArchiveService.archive_file` & `SyncService`**:
   - `get_by_hash(file_hash)` checked for deduplication globally across the whole database rather than per channel.

3. **Missing `channel_id` in Frontend Multipart Upload**:
   - [`frontend/src/api.ts`](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/frontend/src/api.ts) `uploadMediaFile` did not accept or append `channel_id` to `FormData`.

---

## 2. Problem Summary: 200 Media Sync Limit & Incremental Sync Trap

### User Report
> *"i tested connecting to a channel with 1200 media, but the app only fetch 200 , i think theres a cap somewhere in the code"*

### Root Cause Analysis
1. **Hardcoded 200 Limit Across the Full Stack**:
   - [`src/services/sync_service.py`](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/services/sync_service.py): `sync_channel_history(limit: int = 200)` had a hardcoded default of 200.
   - [`src/api/routes/sync.py`](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/api/routes/sync.py): `SyncRequest.limit` had `default=200, le=1000`, causing 422 Unprocessable Entity errors when requesting over 1,000 items.
   - [`frontend/src/api.ts`](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/frontend/src/api.ts): `triggerVaultSync` and `triggerChannelSync` passed `limit = 200`.
2. **The Incremental Sync Early-Termination Trap**:
   - In `sync_service.py`:
     ```python
     if not full_scan and consecutive_indexed >= 10:
         break
     ```
   - When a channel was first indexed, it fetched only the newest 200 messages (e.g. messages 1001–1200).
   - On subsequent syncs, Telethon scanned from newest message downwards. Because messages 1200, 1199, 1198... 1190 were already in the catalog, `consecutive_indexed` immediately reached 10 and aborted!
   - Messages 1–1000 were permanently trapped and never indexed.

---

## 3. Architecture & Implementation Solutions

### A. Senior DBA Covered Index Bounds Check (`MediaRepository`)
- Added [`MediaRepository.get_channel_message_bounds(channel_id)`](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/database/repository.py):
  ```sql
  SELECT MIN(telegram_message_id), MAX(telegram_message_id)
  FROM media_items
  WHERE telegram_channel_id = ? AND is_deleted = 0;
  ```
  Runs in $O(1)$ time leveraging the composite covered index `idx_media_channel_msg`.

### B. Origin-Aware Gap-Filling Sync Engine (`SyncService`)
- Updated [`src/services/sync_service.py`](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/services/sync_service.py):
  - Removed limit caps (`limit: Optional[int] = None`). When `limit=None`, Telethon streams all messages without truncation.
  - Implemented origin-aware detection:
    ```python
    min_db_msg, max_db_msg = await self.repository.get_channel_message_bounds(target_channel)
    has_synced_to_origin = (
        (min_db_msg is not None and min_db_msg <= 25)
        or (target_channel in self._completed_origin_channels)
    )
    ```
  - Incremental fast-path only terminates early if `has_synced_to_origin` is `True` AND `message.id <= max_db_msg`. If a channel has historical gaps, the sync engine refuses to abort early and continuously backfills all missing historical messages.
  - Upon completing a full historical traversal to inception, the channel is registered in `self._completed_origin_channels`.

### C. UI/UX Enhancements
- **Sidebar (`frontend/src/components/Sidebar.tsx`)**:
  - Sync button enhanced: Regular click triggers incremental sync; `Shift + Click` triggers deep full scan.
- **Command Palette (`frontend/src/components/ui/CommandPalette.tsx`)**:
  - Added two explicit commands: `Sync Active Vault` and `Deep Sync Active Vault (Full Scan)`.
- **Auto-Sync on Vault Switch (`frontend/src/App.tsx`)**:
  - Automatically triggers `triggerVaultSync(channelId, true)` (Full Scan) when switching to a vault with 0 items.

---

## 4. Floating SyncToast Notification Banner

### Implementation ([`SyncToast.tsx`](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/frontend/src/components/ui/SyncToast.tsx))
- **Placement**: Centered floating capsule at workspace bottom (`fixed bottom-8 left-0 right-0 md:left-64 z-50`).
- **Copy**: *"We're indexing your medias, sit back and relax"* + contextual vault title subtitle (`Scanning <vaultTitle>... • Xs`).
- **Visuals**: Animated spinning `RefreshCw` icon, glowing radar dot (`animate-ping`), indeterminate progress shimmer bar, and real-time elapsed seconds timer.

---

## 5. Thumbnail Resolution Bugfix: Purging Low-Res Stripped Placeholders

### User Report & Symptom
> *"ok now im browsing the vault with that 500 medias, but the thumbnails are like this , what happen in the background really and cause this"*
> User attached screenshot showing pixelated/blurry square artifacts on all cards.

### Root Cause
1. **Telegram's `PhotoStrippedSize` is a 20-40px Placeholder**:
   - In Telegram MTProto, `PhotoStrippedSize` contains an ultra-compressed, tiny thumbnail (~20x40 to 40x27 pixels, ~300 bytes) designed exclusively for Telegram's native chat UI to show a blurred background while downloading media.
   - When we parsed `PhotoStrippedSize` in `sync_service.py`, it saved those tiny 20x40px images into `.thumbnails/{file_hash}.webp`.
   - When the gallery rendered the cards at 300x300px, the browser stretched the 20x40px image 10x, creating blocky pixelation.
2. **False Cache Hit**:
   - Because the 400-byte `.webp` file existed on disk, the thumbnail endpoint (`/api/media/{id}/thumbnail`) served it from disk without triggering the high-res Telegram download.

### Solution Implemented
1. **Reverted `PhotoStrippedSize` in `src/services/sync_service.py`**:
   - Switched back to proper `client.download_media(message, thumb=-1, file=bytes)`. Telethon's `thumb=-1` specifically selects the highest-resolution `PhotoSize` (320px–480px) thumbnail.
2. **Enforced Cache Size Threshold in `thumbnail_service.py` & `thumbnails.py`**:
   - Valid thumbnails are require to be `>= 1200` bytes (real thumbnails average 8,000–20,000 bytes).
   - Any thumbnail file `< 1200` bytes is treated as an invalid placeholder, unlinked, and automatically re-extracted from Telegram in full resolution.
3. **Purged & Regenerated Vault**:
   - Deleted all 298 tiny `< 1200` byte files from `.thumbnails/`.
   - Regenerated all 296 thumbnails for Goonstash (`-1003887595530`) in full resolution (320px–480px WebP, 8KB–15KB).
