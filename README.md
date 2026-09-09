<!--
=============================================================================
Module: README.md
Purpose: Comprehensive project documentation, architecture guide, legal disclaimers,
         and setup instructions for Tellery (Gallery Vault) v1.0.0.
Used by: Developers, users, open-source community, and deployment workflows.
Dependencies: None.
Public Members: Overview, Architecture, Key Features, Getting Started, Usage, Verification, Support.
Side Effects: None (Documentation).
=============================================================================
-->

# Tellery (Gallery Vault) — Personal Telegram Media Archive & Streaming Gallery

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-emerald.svg?style=flat-square)](CHANGELOG.md)
[![Support on Ko-fi](https://img.shields.io/badge/Support%20on-Ko--fi-F16061?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/rizkysanjaya)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)

**Tellery** is a self-hosted, zero-cost personal media preservation and instant streaming gallery. It bridges private Telegram channels (as an uncompressed, unlimited,  cloud warehouse) with a local high-performance SQLite catalog and a modern web frontend featuring 100k+ keyset pagination, seekable HTTP 206 streaming, EXIF timeline exploration, and multi-vault channel isolation.

---

## 🏛️ Architecture Overview

`
                      ┌───────────────────────────────────────────────┐
                      │    Tellery (Gallery Vault) Web UI (React+TS)  │
                      │       Timeline Grid • Lightbox • Player       │
                      └───────────────────────┬───────────────────────┘
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
`

---

## ✨ Key Features in v1.0.0

1. **100% Bit-for-Bit Lossless Preservation**:
   - Files are uploaded with orce_document=True, completely bypassing Telegram's lossy image/video compression and preserving raw camera EXIF metadata and color profiles.
2. **Instant (\log N)$ Cryptographic Deduplication**:
   - Computes SHA-256 in 64KB streaming chunks.
   - Detects identical files in **<15ms** via SQLite unique B-tree indices with zero redundant network transfers.
3. **Multi-Vault Switching & Channel Isolation**:
   - Connect and manage multiple private Telegram storage channels or supergroups.
   - Media, virtual albums, favorites, and trash are strictly isolated per vault with role-based permission gating (Owner vs. Read-Only).
4. **100,000+ Keyset Cursor Pagination & Virtual Windowing**:
   - Sub-millisecond timeline queries powered by indexed composite cursor keys ((date_taken, id)).
   - Fluid, zero-flicker scrolling through massive libraries without memory leaks.
5. **Zero-Config Browser Onboarding Wizard**:
   - Authenticate with Telegram MTProto directly inside the browser using your phone number and SMS/Telegram login code — no manual .env file editing required.
6. **Seekable HTTP 206 Partial Content Streaming**:
   - Translates browser video player Range: bytes=start-end requests directly into Telegram MTProto chunk offsets (iter_download).
   - Scrub and play multi-gigabyte 4K videos instantly without downloading the whole file first.
7. **VS Code-Style 10-Theme System**:
   - Switch live between **Obsidian**, **Light**, **Matcha**, **Solar Flare**, **Tuscan**, **Tokyo**, **Abyss**, **Amethyst**, **Vapor Lime**, and **Sakura**.
   - True OLED Pure Black (#000000) and WCAG 2.2 AA compliant contrast across both dark and light modes.
8. **Soft-Delete Trash & Data Recovery**:
   - Accidental deletions are safeguarded with soft-delete trash staging, a 10-second interactive undo countdown toast, and 1-click restoration.
9. **Animated MP4 Video Avatars**:
   - Detects and loops animated Telegram profile avatars for channels and user accounts with static JPEG poster fallbacks.
10. **Battery Saver Mode**:
    - Low-power GPU and CPU conservation mode that disables intensive shaders and pauses video avatars.
11. **Zero Ongoing Cost ( Cloud Hosting)**:
    - Runs 100% locally with an embedded SQLite database in WAL mode. Access anywhere using Cloudflare Tunnels or Tailscale VPN.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.10+** (tested on Python 3.11 – 3.14)
- **Node.js 18+** (tested on Node v20 – v25)
- Telegram account and API credentials from [my.telegram.org](https://my.telegram.org)

### 2. Quick Setup

`ash
# Clone repository
git clone https://github.com/rizkysanjaya/tele-gallery-storage.git
cd tele-gallery-storage

# 1. Install backend dependencies
pip install -r requirements.txt

# 2. Build frontend assets
cd frontend
npm install
npm run build
cd ..

# 3. Launch Tellery server
python -m src.main --host 127.0.0.1 --port 8000
`

Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser!
The interactive onboarding wizard will guide you through connecting your Telegram account and setting up your first vault.

Interactive Swagger API docs are available at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**.

---

## 💻 Batch CLI Ingestion

Point the batch importer at any local directory or external hard drive:

`ash
# Dry run to preview file scan and check deduplication stats:
python -m src.cli.import_folder "D:\Pictures\Vacation" --dry-run

# Live ingestion and Telegram upload:
python -m src.cli.import_folder "D:\Pictures\Vacation"
`

---

## 🌐 Remote Access ( Deployment Guide)

To access your personal Tellery vault securely from your smartphone or tablet from anywhere in the world:

### Option A: Cloudflare Tunnel (Recommended)
1. Download cloudflared from Cloudflare (free).
2. Run:
   `ash
   cloudflared tunnel --url http://localhost:8000
   `
3. Cloudflare gives you a secure HTTPS URL (e.g. https://your-vault.trycloudflare.com) accessible from any browser with end-to-end TLS encryption.

### Option B: Tailscale VPN
1. Install [Tailscale](https://tailscale.com) on your computer and phone (free).
2. Open http://<your-tailscale-device-ip>:8000 on your mobile browser.

---

## ☕ Support & Donations

If you find Tellery useful for liberating your personal media library and eliminating recurring cloud storage subscription fees, please consider supporting the project:

[![Support on Ko-fi](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/rizkysanjaya)

Your support helps cover development time, testing hardware, and future native desktop/mobile clients!

---

## 🔒 Privacy & Data Ownership

- **Zero Telemetry**: Tellery collects **zero** analytics, telemetry, or user behavior data.
- **Direct MTProto Connection**: All network requests communicate directly between your self-hosted instance and official Telegram servers via encrypted MTProto.
- **Local SQLite Metadata**: Your file index, thumbnails, and virtual albums reside entirely on your own local disk.

---

## ⚖️ Legal Disclaimer

- **Independent Software**: Tellery is an independent, open-source project and is **not** affiliated with, authorized, maintained, sponsored, or endorsed by Telegram FZ-LLC or any of its affiliates.
- **Terms of Service**: Users are responsible for ensuring that their usage complies with Telegram's Terms of Service and applicable local copyright laws.
- **Warranty Disclaimer**: This software is distributed under the MIT License on an "AS IS" basis, without warranties or conditions of any kind. See the [LICENSE](LICENSE) file for details.
