<!--
=============================================================================
Module: README.md
Purpose: Comprehensive project documentation, architecture guide, comparison table,
         responsible use guidelines, and setup instructions for Tellery (Gallery Vault) v1.0.0.
Used by: Developers, users, open-source community, and deployment workflows.
Dependencies: None.
Public Members: Overview, Journey, Features, Comparison, Quickstart, Architecture, Responsible Use, FAQ, Support.
Side Effects: None (Documentation).
=============================================================================
-->

<div align="center">

# ☁️ Tellery (Gallery Vault)
### *Personal Telegram Media Archive & Instant Streaming Gallery*

**Zero subscription fees. Bit-for-bit lossless preservation. Seekable 4K streaming.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-emerald.svg?style=flat-square)](CHANGELOG.md)
[![Support on Ko-fi](https://img.shields.io/badge/Support%20on-Ko--fi-F16061?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/gomski)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](#-docker-deployment)

<p>
  <a href="#-quickstart-1-command"><strong>Quickstart</strong></a> ·
  <a href="#-our-journey"><strong>Our Journey</strong></a> ·
  <a href="#-key-features"><strong>Features</strong></a> ·
  <a href="#-comparison"><strong>Comparison</strong></a> ·
  <a href="#-architecture"><strong>Architecture</strong></a> ·
  <a href="#-responsible-use--safety"><strong>Responsible Use</strong></a> ·
  <a href="#-faq"><strong>FAQ</strong></a> ·
  <a href="#-support--sponsorship"><strong>Support</strong></a>
</p>

</div>

---

## ⚡ At a Glance

| Attribute | Specification |
|---|---|
| **Storage Backend** | Telegram MTProto Document Warehouse (uncompressed, zero recurring storage fee) |
| **Catalog Engine** | Local SQLite in Write-Ahead Logging (WAL) mode with composite keyset B-tree indices |
| **Streaming Protocol** | HTTP 206 Partial Content Range streaming mapped directly to MTProto chunk offsets |
| **Scalability** | 100,000+ media items with sub-millisecond cursor pagination and virtual windowing |
| **Ingestion Paths** | Zero-config in-browser web drag-and-drop, multi-folder HTML5 scanner, and high-speed batch CLI |
| **Multi-Vault Support** | Multi-channel switching with isolated media rows, virtual albums, favorites, and trash |
| **Aesthetic Engine** | Pro Flat Obsidian craft (Apple/Linear precision) with 10 VS Code-style color themes & OLED black |
| **Platforms** | Windows, macOS, Linux, Docker, and free mobile access via Cloudflare Tunnel / Tailscale |
| **Data Privacy** | 100% self-hosted local execution; zero analytics, zero telemetry, zero intermediate servers |

---

## 📖 Our Journey

### The Problem: The Cloud Storage Tax
For years, personal digital media archiving was simple. Then came the era of **recurring subscription lock-in**:
- **Google Photos** canceled its unlimited free storage tier, forcing users into monthly Google One subscriptions.
- **iCloud** storage tiers escalate rapidly as 4K phone videos consume 50GB–2TB in a few months.
- **Physical Hard Drives & Home NAS** setups offer independence, but require hundreds of dollars in high-capacity hard drives, RAID arrays, redundant offsite backups, and ongoing hardware maintenance.

### The Realization
Meanwhile, **Telegram** operates one of the world's most resilient, globally distributed, and generous document storage backends via its official MTProto protocol:
- Up to **2 GB per file** (4 GB for Premium users).
- Unlimited total storage in private channels and supergroups.
- Bit-for-bit lossless document preservation when uploaded with orce_document=True.

**The missing piece?** Telegram is a messaging client, **not a media gallery**. It lacks camera EXIF date grouping, duplicate detection, virtual album organization, seekable 4K video playback, and smooth infinite timeline scrolling.

### The Solution: Tellery
**Tellery** bridges this divide. It turns your private Telegram channel into an **unlimited, zero-cost personal media cloud** paired with a local high-performance SQLite catalog and a desktop-grade web application. 

You get the visual fluidity of Google Photos and the architectural freedom of self-hosting, with **zero monthly cloud storage bills**.

---

## 🚀 Quickstart (1-Command)

Tellery is designed to run in **one command** with zero tedious configuration.

### Option A: Windows (1-Click)
1. Clone or download the repository:
   `ash
   git clone https://github.com/rizkysanjaya/tele-gallery-storage.git
   cd tele-gallery-storage
   `
2. Double-click **start.bat** (or run python run.py).
3. Your default web browser will automatically open to **http://127.0.0.1:8000**!

### Option B: Linux & macOS
`ash
git clone https://github.com/rizkysanjaya/tele-gallery-storage.git
cd tele-gallery-storage
pip install -r requirements.txt
python run.py
`

### Option C: Docker Deployment
`ash
docker compose up -d
`
Open **[http://localhost:8000](http://localhost:8000)**.

> **💡 Zero Manual .env Editing Needed**: On your first visit, Tellery launches an interactive **Onboarding Wizard** right in your browser. Enter your phone number, receive your Telegram login code, and connect your private storage vault in seconds.

---

## ✨ Key Features

### 1. 🛡️ 100% Bit-for-Bit Lossless Preservation
Files are uploaded with orce_document=True. Telegram's aggressive image and video compression algorithms are completely bypassed. Your original camera RAW data, full-resolution JPEGs, ProRes/HEVC 4K videos, and embedded EXIF metadata remain perfectly untouched.

### 2. ⚡ Instant (\log N)$ Cryptographic Deduplication
Tellery computes a streaming SHA-256 hash in 64KB chunks before any network transfer. If an identical photo or video already exists in your vault, it is cataloged in **<15ms** via SQLite B-tree index lookup with zero redundant upload bandwidth.

### 3. 🎬 Seekable HTTP 206 Partial Content Streaming
Standard Telegram bots require downloading an entire 1GB+ video file before you can play it. Tellery translates your browser's native Range: bytes=start-end requests directly into MTProto chunk offset streams (iter_download). You can jump to minute 45 of a 4K movie and start watching immediately.

### 4. 🗄️ Multi-Vault Switching & Channel Isolation
Organize your life into separate vaults (e.g. *Personal Vault*, *Family Archive*, *Work Media*). Tellery provides one-click channel switching with strict SQLite row isolation (channel_id scoping) for media items, virtual folders, favorites, and trash.

### 5. ♾️ 100,000+ Keyset Cursor Pagination & Virtual Windowing
Engineered for massive libraries. Instead of sluggish OFFSET database queries that choke at scale, Tellery uses indexed composite keyset cursors (date_taken, id). Timeline queries execute in **sub-millisecond** time, paired with virtual DOM windowing for silky-smooth 60fps scrolling.

### 6. 🎨 VS Code-Style 10-Theme Palette & Pure OLED Black
Switch color themes on the fly from the Settings dialog or Command Palette (Ctrl+K):
- **Obsidian** (Pure OLED #000000) · **Light** · **Matcha** · **Solar Flare** · **Tuscan** · **Tokyo** · **Abyss** · **Amethyst** · **Vapor Lime** · **Sakura**
- Every theme meets **WCAG 2.2 AA** contrast guidelines in both dark and light modes.

### 7. ♻️ Soft-Delete Trash & 10-Second Undo Recovery
Never worry about accidental deletions. Items moved to trash are isolated with a 10-second interactive countdown undo toast, and can be restored with a single click or permanently purged at will.

### 8. 🎭 Animated MP4 Video Avatars & Battery Saver
Tellery automatically fetches and loops Telegram .mp4 video profile avatars for both your channels and your user account, complete with static JPEG poster fallbacks. Enabling **Battery Saver** mode automatically dials back shaders and pauses video loops to conserve laptop battery.

---

## 📊 Comparison

| Feature | Tellery (Gallery Vault) | Google Photos / iCloud | Immich / PhotoPrism | Basic Telegram Bots |
|---|:---:|:---:|:---:|:---:|
| **Monthly Storage Cost** | ** / month** |  –  / month |  (software) |  |
| **Local Hard Drive Required** | **~2 GB** (cache only) | None | 2 TB – 16 TB NAS (–) | None |
| **Compression** | **None** (bit-for-bit lossless) | Compressed unless paying top tier | None (lossless) | Often compressed |
| **Seekable 4K Video Streaming** | **Yes** (HTTP 206 chunk-aligned) | Yes | Yes | ❌ (Full download needed) |
| **100k+ Keyset Virtual Timeline** | **Yes** (<1ms cursor queries) | Yes | Yes | ❌ (No visual timeline) |
| **Multi-Vault Channel Isolation** | **Yes** (Owner vs Read-Only) | ❌ | Partial (multi-user) | ❌ |
| **In-Browser Onboarding** | **Yes** (Phone + Code) | Yes | ❌ (Requires Docker/YAML) | ❌ |
| **EXIF Camera Metadata & Scrubber** | **Yes** (Make, Model, Dimensions) | Yes | Yes | ❌ |
| **Data Ownership** | **100% Yours** (Private Telegram) | Vendor Lock-in | 100% Yours | 100% Yours |

---

## 🏛️ Architecture

`
┌─────────────────────────────────────────────────────────────────────────┐
│                    Tellery Web Client (React 18 + TS)                   │
│         Timeline Grid • Keyset Windowing • Lightbox • Video Player       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP 206 / REST
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FastAPI Backend Engine                          │
│        Auth Service • Transcoder • Deduplicator • Vault Service         │
└──────────────────┬──────────────────────────────────────┬───────────────┘
                   │                                      │
    ┌──────────────┴──────────────┐        ┌──────────────┴───────────────┐
    ▼                             ▼        ▼                              ▼
┌───────────────┐         ┌───────────────┐      ┌────────────────────────┐
│ Local SQLite  │         │ Local Disk    │      │ Telegram MTProto       │
│ WAL Database  │         │ WebP Cache    │      │ Document Cloud         │
│ (Metadata/Idx)│         │ (.thumbnails) │      │ (Raw Bit-for-bit Files)│
└───────────────┘         └───────────────┘      └────────────────────────┘
`

---

## 🛡️ Responsible Use & Safety

Tellery is engineered to be a respectful, reliable, and defensive MTProto client:

1. **Personal Storage Only**: Tellery is strictly intended for personal media preservation in your own private channels or supergroups.
2. **Defensive Rate Limiting**: The upload engine enforces sequential chunk spooling and concurrency limits to respect Telegram's rate-limiting policies and prevent FloodWait penalties.
3. **No Multi-Tenant Public Hosting**: Do **not** host Tellery as a public, multi-user anonymous file-sharing service. Doing so violates Telegram's API Terms of Service.
4. **Data Ownership**: You control your Telegram account and your private channel. Tellery does not operate any intermediate proxy servers.

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Will Telegram ban my account for storing personal photos and videos?</strong></summary>
<br>
No. Using Telegram to store your own media in private channels is completely standard and permitted under Telegram's API Terms of Service. Tellery uses official MTProto protocols and connects directly using your own API credentials. As long as you use it for personal storage and do not operate a commercial file-locker service, your account is completely safe.
</details>

<details>
<summary><strong>What is the maximum file size I can upload?</strong></summary>
<br>
Telegram supports up to <strong>2 GB per file</strong> for standard accounts and up to <strong>4 GB per file</strong> for Telegram Premium subscribers. There is no limit on the total number of files or total gigabytes you can store in your vault.
</details>

<details>
<summary><strong>Does Telegram compress my photos or videos?</strong></summary>
<br>
No! Unlike sending photos in normal Telegram chats, Tellery uploads all media with <code>force_document=True</code>. Telegram treats them as raw binary documents, preserving every byte, resolution pixel, color profile, and EXIF camera tag without compression.
</details>

<details>
<summary><strong>How do I access Tellery securely on my phone or outside my home network?</strong></summary>
<br>
You can access your Tellery instance from anywhere with 100% free TLS encryption using either:
<ul>
  <li><strong>Cloudflare Tunnel (Recommended)</strong>: Run <code>cloudflared tunnel --url http://localhost:8000</code> to get a private, encrypted HTTPS link (e.g. <code>https://my-vault.trycloudflare.com</code>).</li>
  <li><strong>Tailscale VPN</strong>: Install Tailscale on your host computer and your phone to access <code>http://[tailscale-ip]:8000</code> with zero open ports.</li>
</ul>
</details>

<details>
<summary><strong>What happens if my computer crashes or I delete the local database?</strong></summary>
<br>
Your media is safely preserved in your Telegram channel! Simply launch Tellery and click <strong>"Sync Vault"</strong> in the sidebar (or via <code>Ctrl+K</code>). Tellery will read your channel's message history and automatically reconstruct the entire SQLite database and local thumbnail cache.
</details>

<details>
<summary><strong>Can I invite friends or family to view my vault?</strong></summary>
<br>
Yes! You can invite friends or family members to your Telegram channel as viewers. When they log in to Tellery, the channel will be detected in their vault switcher as a <strong>Read-Only Vault</strong>, allowing them to browse and stream without permission to delete or alter files.
</details>

---

## ☕ Support & Sponsorship

Tellery is 100% free and open-source software built for the self-hosted community. If Tellery saves you monthly cloud storage fees or helps you preserve your cherished memories, please consider buying the creator a coffee!

<div align="center">

[![Buy Me a Coffee on Ko-fi](https://img.shields.io/badge/Support%20Tellery%20on-Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/gomski)

*Your support directly funds development time, testing hardware, and future native desktop and mobile clients!*

</div>

---

## ⚖️ Legal Disclaimer

- **Independent Project**: Tellery is an independent, open-source software project and is **not** affiliated with, authorized, maintained, sponsored, or endorsed by Telegram FZ-LLC or any of its subsidiaries.
- **Terms Compliance**: Users are solely responsible for ensuring that their use of Tellery adheres to Telegram's Terms of Service and all relevant local laws.
- **Warranty Disclaimer**: This software is provided under the [MIT License](LICENSE) on an "AS IS" basis without warranties or conditions of any kind.
