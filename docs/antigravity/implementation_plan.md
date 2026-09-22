# Bugfix: Upload/Sync Channel ID Normalization & Full-Stack 100k+ Scalability

This plan addresses:
1. **Critical Bugfix**: Resolving why newly uploaded items didn't appear in the gallery and sync reported "0 item added".
2. **Full-Stack Scalability Architecture (100,000+ items)**: Clarifying and designing end-to-end scalability across the Database, Backend API, and Frontend UI.

---

## User Review Required

> [!IMPORTANT]
> **Root Cause of Missing Uploads & "0 item added" on Sync:**
> 1. **Stripped `-100` Prefix during Web Upload:** In `src/services/archive_service.py` line 175, `telegram_channel_id` was saved as `int(str(target_channel).replace("-100", ""))` (positive integer `2376755502`).
> 2. **Timeline Filter Mismatch:** The active vault and timeline query look for `telegram_channel_id = -1002376755502`. Because of the mismatch, all 18 web-uploaded items were filtered out and completely invisible.
> 3. **Sync Skip:** When the user clicked "Sync with Telegram", `SyncService` checked whether the Telegram message ID already existed in the catalog. Since it was already indexed by upload, sync skipped it with `"already_indexed"`, reporting **`0 item added`**, leaving the items invisible.
> 
> **Immediate Solution:**
> - Migrate the 18 rows in `data/telegallery.db` where `telegram_channel_id > 0` to standard `-100...` so all uploaded items appear in the gallery immediately.
> - Normalize all incoming and stored channel IDs across `ArchiveService`, `SyncService`, and `MediaRepository` to canonical `-100...`.
> - Add auto-migration in `src/database/connection.py` on startup.

> [!IMPORTANT]
> **Is Scalability Only for UI or the Whole App?**
> **It is 100% Full-Stack.** Scaling to 100,000+ items cannot be solved on the UI alone:
> - **Database Layer:** Standard `OFFSET N` scans and discards $N$ B-tree tuples ($O(N)$). At 100,000 items, `OFFSET 100000` degrades to hundreds of milliseconds of disk I/O. We implement **Keyset Cursor Pagination** (`(date_taken, id) < (cursor_date, cursor_id)`), ensuring instant $O(\log N)$ (<1ms) seek time regardless of gallery depth, backed by covering index `idx_media_channel_timeline`.
> - **API & Network Layer:** Cursor-based pagination with `next_cursor` tokens and a fast aggregated date-scrubber endpoint (`/api/media/summary`) so the UI doesn't download metadata for 100k items just to show the scrollbar years.
> - **Frontend UI Layer:** Rendering 100,000 (or even 2,000) DOM nodes will crash browser memory and cause massive frame drops. We implement **Virtual Windowing** so only the ~25 items visible in the viewport (+ overscan buffer) are rendered in the DOM, keeping memory flat and scroll butter-smooth at 60–120 FPS.

---

## Proposed Changes

### Phase 1: Upload / Sync Channel ID Normalization Bugfix

#### [MODIFY] [connection.py](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/database/connection.py)
- Export `normalize_channel_id(channel_id: Union[int, str, None]) -> Optional[int]`:
  Canonicalizes any channel ID format (`2376755502`, `"-1002376755502"`, `"2376755502"`) to `-1002376755502`.
- Add auto-migration in `init_db()` to update any existing rows where `telegram_channel_id > 0` in both `media_items` and `folders` tables:
  ```sql
  UPDATE media_items SET telegram_channel_id = -CAST(('100' || telegram_channel_id) AS INTEGER) WHERE telegram_channel_id > 0;
  UPDATE folders SET telegram_channel_id = -CAST(('100' || telegram_channel_id) AS INTEGER) WHERE telegram_channel_id > 0;
  ```

#### [MODIFY] [archive_service.py](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/services/archive_service.py)
- Normalize `target_channel` at line 75 with `normalize_channel_id()`.
- Fix line 175: replace `int(str(target_channel).replace("-100", ""))` with `target_channel`.
- Fix line 213: ensure `telegram_channel_id` returned is canonical.
- Update header doc per rules.

#### [MODIFY] [sync_service.py](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/services/sync_service.py)
- Normalize `target_channel_id` with `normalize_channel_id()`.
- Clean up deletion reconciliation query to use canonical channel ID.
- Update header doc per rules.

#### [MODIFY] [repository.py](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/database/repository.py)
- Normalize `channel_id` across `get_timeline()`, `get_stats()`, `get_filter_metadata()`, `get_by_channel_message()`, and other queries so any channel format passed will match accurately.
- Update header doc per rules.

---

### Phase 2: Full-Stack Scalability (100,000+ Items)

#### [MODIFY] [repository.py](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/database/repository.py)
- Add Keyset Cursor support to `get_timeline()`:
  - If `cursor` (`cursor_date:cursor_id`) is passed, query with:
    `WHERE (COALESCE(m.date_taken, m.created_at) < ? OR (COALESCE(m.date_taken, m.created_at) = ? AND m.id < ?))`
  - Preserves exact index usage on `idx_media_channel_timeline(telegram_channel_id, date_taken DESC, id DESC)` with 0ms temp sorting.
  - Return `next_cursor` alongside items.
- Add `get_timeline_summary(channel_id)`:
  - Ultra-fast indexed aggregation (`COUNT(*)` grouped by `strftime('%Y-%m', date_taken)`).
  - Supplies the frontend timeline scrubber with date markers without loading item payloads.

#### [MODIFY] [media.py](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/api/routes/media.py) & [schemas.py](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/src/api/schemas.py)
- Support `cursor` query parameter in `GET /api/media` and return `next_cursor: Optional[str]` and `has_more: bool` in `TimelineResponse`.
- Add `GET /api/media/summary` endpoint returning month/year buckets and counts.

#### [MODIFY] [TimelineGrid.tsx](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/frontend/src/components/TimelineGrid.tsx) & [App.tsx](file:///c:/Users/sanja/OneDrive/Documents/Project%20AI/tele-gallery-storage/frontend/src/App.tsx)
- Implement windowed section rendering / virtual list:
  - Only mount active DOM cards for visible groups and immediate adjacent buffer groups.
  - Off-screen groups retain their height container placeholder (preventing scroll jumping) while unmounting heavy DOM nodes and image elements.
- Keyset cursor-based infinite scroll:
  - Automatically loads the next chunk of 50 items using `next_cursor` when user scrolls within 500px of bottom.

---

## Verification Plan

### Automated Tests
1. **DB Migration & Query Plan Verification**:
   - Run Python script verifying all `telegram_channel_id` values in `data/telegallery.db` are negative (`< 0`).
   - Run `EXPLAIN QUERY PLAN` on keyset cursor query to ensure index scan without temp b-tree.
2. **Frontend Type Check & Build**:
   - Run `npm run build` in `frontend/` to confirm zero TypeScript compilation errors.
3. **Backend Route Smoke Test**:
   - Test `GET /api/media?limit=50` to verify newly uploaded items appear immediately with valid metadata.

### Manual Verification
1. Verify the 18 previously uploaded items now render in the gallery under their correct channel.
2. Trigger "Sync Telegram" -> verify it does not produce anomalies and properly tracks items.
3. Perform a new test file upload -> verify it immediately shows up in the gallery without requiring manual refresh or sync.
