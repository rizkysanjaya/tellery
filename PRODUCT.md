<!--
=============================================================================
Module: PRODUCT.md
Purpose: Durable product truth specification and architecture contract for Tellery.
Used by: Impeccable design system, AI agents, UI engineering workflows.
Dependencies: None.
Public Members: Product definition, platform, positioning, constraints, principles.
Side Effects: Serves as single source of product truth across all design and development passes.
=============================================================================
-->

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal archive owners, content creators, and privacy-conscious users who want an expansive personal photo and video vault without recurring cloud storage subscription fees.

## Product Purpose

Tellery delivers a zero-storage-cost personal media preservation and instant streaming gallery. It bridges a private Telegram channel (uncompressed, unlimited $0 cloud warehouse) with a local SQLite metadata catalog and a modern, high-performance web storefront. Success means managing thousands of high-resolution photos and 4K videos with Google Photos/Drive-grade fluidity, instant seekable streaming, and complete data ownership.

## Positioning

Unlike conventional cloud storage (Google Photos/iCloud/Dropbox) that charges recurring monthly storage fees, and unlike basic Telegram file bots that only serve download links or media players, Tellery provides a true visual archive experience: automated SHA-256 deduplication, EXIF timeline organization, local WebP thumbnail caching, multi-select bulk workflows, virtual folder/album hierarchies, and HTTP 206 chunk-aligned video seeking.

## Operating Context

- **Environment**: Self-hosted local or private network server (FastAPI backend + Vite React SPA).
- **Storage Tier**: Telegram MTProto channel utilizing `force_document=True` to preserve bit-for-bit uncompressed originals.
- **Workflow**: Automated recursive local directory ingestion via CLI and drag-and-drop web uploads; instant timeline exploration, multi-select album organization, right-click contextual management, and seekable playback.

## Capabilities and Constraints

- **Capabilities**:
  - Uncompressed raw media vault in private Telegram channels.
  - O(log N) SHA-256 duplicate rejection with zero network overhead.
  - Sub-millisecond EXIF timeline grouping by Month/Year.
  - Local high-efficiency WebP thumbnail cache with auto-rotation.
  - Seekable HTTP 206 partial content streaming aligned to MTProto chunk boundaries.
  - Virtual Folders and Albums (zero byte duplication across albums).
  - Multi-select system with floating action toolbar and bulk operations.
  - Direct web drag-and-drop upload and permanent multi-tier deletion.
- **Constraints**:
  - Telegram MTProto upload rate limits (defensive throttle to prevent FloodWait).
  - Web client relies on modern HTML5 video/image codecs.

## Brand Commitments

- **Name**: TeleGallery
- **Aesthetic Direction**: High-contrast, dark-mode studio UI (zinc/slate surfaces, sky-blue focal accents, smooth micro-interactions).
- **Tone**: Fast, reliable, archival-grade, minimal friction.

## Evidence on Hand

- Fully operational backend in Python (FastAPI + Telethon + SQLite WAL mode).
- Functional React 19 + TypeScript + Vite + Tailwind CSS frontend.
- Automated integration test suites for HTTP 206 streaming and virtual folders (`test_api_streaming.py`, `test_folders.py`).

## Product Principles

1. **Zero-Duplication Integrity**: Files are stored once in the vault; albums, tags, and views are lightweight relational pointers.
2. **Instant Fluidity**: Heavy operations (thumbnails, caching, search indexes) are pre-calculated; UI never blocks or stutters during timeline scrolling or video seeking.
3. **Desktop-Grade Interaction**: Support rich keyboard shortcuts, multi-selection, drag-and-drop, and contextual menus equivalent to native file managers.
4. **Resilient Archival**: Maintain byte-for-byte exactness for all preserved media.
