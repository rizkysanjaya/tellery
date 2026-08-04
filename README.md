# TeleGallery — Personal Telegram Media Archive & Streaming Gallery

A self-hosted, zero-cost personal media preservation and streaming gallery using Telegram MTProto as a remote document warehouse, indexed via a local high-performance SQLite catalog, with EXIF timeline organization, WebP thumbnail caching, cryptographic deduplication, and HTTP 206 seekable streaming.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    TeleGallery Web UI (React + TS)     │
                      │  Timeline Grid • Lightbox • Player     │
                      └───────────────────┬────────────────────┘
                                          │ HTTP / REST & Range
                                          ▼
                      ┌────────────────────────────────────────┐
                      │          FastAPI Archive Engine        │
                      │  Auth • Ingest • Cache • MTProto Proxy │
                      └───────┬───────────────────┬────────────┘
                              │                   │
               ┌──────────────┴───────┐   ┌───────┴────────────────────┐
               ▼                      ▼   ▼                            ▼
       ┌───────────────┐     ┌─────────────────┐             ┌───────────────────┐
       │ Local SQLite  │     │ WebP Thumbnail  │             │ Telegram MTProto  │
       │ WAL Catalog   │     │ Local Disk Cache│             │ Storage Warehouse │
       │ (EXIF/Hashes) │     │ (Instant Grid)  │             │ (Raw Documents)   │
       └───────────────┘     └─────────────────┘             └───────────────────┘
```

---

## Key Features

1. **100% Bit-for-Bit Lossless Preservation**:
   - Files are uploaded with `force_document=True`, bypassing Telegram's lossy image/video compression and preserving raw EXIF and color profiles.
2. **Instant $O(\log N)$ Cryptographic Deduplication**:
   - Computes SHA-256 in 64KB streaming chunks.
   - Cross-drive scanning detects identical files in **<15ms** using SQLite unique B-tree indices with zero redundant network uploads.
3. **Deep EXIF & Timeline Organization**:
   - Automatically parses camera manufacturer (`Make`), model (`Model`), dimensions, and capture timestamps (`date_taken`).
   - Groups photos and videos into a chronological Google Photos-style timeline.
4. **Zero-Latency WebP Thumbnail Cache**:
   - Generates compact WebP thumbnails (1–2 KB each) saved in `.thumbnails/` and served with immutable browser cache headers.
5. **Seekable HTTP 206 Range Streaming**:
   - Translates browser video player `Range: bytes=start-end` requests directly into MTProto chunk offset downloads (`iter_download`).
   - Click to start playing multi-gigabyte videos instantaneously without downloading the whole file.
6. **Zero Ongoing Cost ($0 Budget)**:
   - Self-contained SQLite database in WAL mode.
   - Runs locally or accessible anywhere via free Cloudflare Tunnels / Tailscale VPN.

---

## Getting Started

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ (tested on Node v25)
- Telegram account and API credentials from [my.telegram.org](https://my.telegram.org)
- A private Telegram channel where you are owner/admin

### 2. Installation
```bash
# 1. Install backend dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
```

Edit `.env`:
```ini
TG_API_ID=your_api_id
TG_API_HASH=your_api_hash
TG_CHANNEL_ID=-100xxxxxxxxxx
TG_SESSION_NAME=telegallery_session
DB_PATH=data/telegallery.db
```

---

## Usage Guide

### 1. Batch Importing Local Media Folders
Point the batch importer at any local folder or external drive:
```bash
# Dry run to analyze files and check deduplication stats:
python -m src.cli.import_folder "D:\Pictures\Vacation 2025" --dry-run

# Live ingestion and Telegram upload:
python -m src.cli.import_folder "D:\Pictures\Vacation 2025"
```

### 2. Launching the Web Gallery Server
Launch the unified server (serves both FastAPI REST/streaming API and compiled React SPA):
```bash
python -m src.main --host 127.0.0.1 --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser!

Interactive Swagger API docs are available at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**.

### 3. Frontend Development (Hot Reloading)
To run the React development server with hot-module replacement:
```bash
cd frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)**.

---

## Automated Verification & Testing

TeleGallery includes automated test suites for every subsystem:

```bash
# Test 1: MTProto Core Storage & Byte-for-byte SHA-256 Integrity
python -m src.cli.verify_pipeline

# Test 2: REST API & HTTP 206 Partial Content Range Streaming
python -m src.cli.test_api_streaming
```

---

## Free Remote Access ($0 Deployment Guide)

To access your personal gallery securely from your phone or outside your home network without paying for VPS hosting:

### Option A: Cloudflare Tunnel (Recommended)
1. Download `cloudflared` from Cloudflare (100% free).
2. Run:
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
3. Cloudflare gives you a secure HTTPS URL (e.g. `https://your-gallery.trycloudflare.com`) accessible from any smartphone or tablet with end-to-end TLS encryption.

### Option B: Tailscale VPN
1. Install [Tailscale](https://tailscale.com) on your computer and phone (free for up to 100 devices).
2. Open `http://<your-tailscale-pc-ip>:8000` on your mobile browser.
