# Tellery (tele-gallery-storage) Agent Guidelines

## Product Overview
Tellery is a personal media vault bridging private Telegram channels (as an uncompressed, zero-cost cloud storage tier) with a local SQLite catalog and a high-performance web gallery.

- **Backend**: FastAPI (Python), SQLite (`data/telegallery.db`), Telethon / MTProto client.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (`frontend/`).
- **Antigravity Migration History**: Previous design plans, security audits, and walkthroughs are archived in `docs/antigravity/`.

---

## Architectural Invariants & Rules

1. **Telegram Channel ID Normalization**:
   - Telegram supergroup/channel IDs must always be canonical `-100...` format (e.g., `-1002376755502`).
   - Use `normalize_channel_id()` in `src/database/connection.py` before inserting or querying. Never strip the `-100` prefix.

2. **Keyset Cursor Pagination (100k+ Scale)**:
   - Never use `OFFSET N` for deep timeline paging.
   - Use cursor keyset pagination: `(date_taken, id) < (cursor_date, cursor_id)` backed by composite index `idx_media_channel_timeline`.

3. **Bit-for-Bit Preservation**:
   - Files uploaded to Telegram must always use document mode (`force_document=True`) to prevent server-side recompression.
   - SHA-256 deduplication is scoped per vault/channel (`telegram_channel_id`).

4. **Streaming & Range Requests**:
   - Video streaming routes in `src/api/routes/media.py` must support HTTP 206 Partial Content.
   - Byte ranges must align with MTProto chunk boundaries (128 KB or 512 KB).

5. **Thumbnail Generation**:
   - Thumbnails are cached locally as WebP in `.thumbnails/`.
   - Sparse MTProto range extraction is used for remote videos without full-file downloads.

6. **Ephemeral Upload Lifecycle (Zero Local Footprint)**:
   - Transient upload buffers in `data/upload_temp` exist strictly for SHA-256 hashing, metadata extraction, thumbnail generation, and MTProto chunking.
   - Do not promote uploaded files to permanent local stream cache. The buffer must be unlinked immediately upon confirmed Telegram receipt to prevent drive exhaustion on large batches.
   - Subsequent playback streams on-demand from Telegram via HTTP 206 range requests under LRU cache bounds.

---

## Commands & Workflows

```bash
# Start backend server
python run.py

# Frontend development
cd frontend && npm run dev

# Frontend production build
cd frontend && npm run build
```

---

## Antigravity Reference Docs
- `docs/antigravity/implementation_plan.md`: Cursor keyset pagination & channel ID normalization.
- `docs/antigravity/walkthrough.md`: Gap-filling sync engine & high-res thumbnail worker.
- `docs/antigravity/audit_report.md`: Security, DBA index tuning, and bundle size audit.
- `docs/antigravity/task.md`: Active task roadmap.
