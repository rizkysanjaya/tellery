<!--
=============================================================================
Module: PRODUCT.md
Purpose: Durable product truth specification and architecture contract for Tellery v1.0.0.
Used by: Impeccable design system, AI agents, UI engineering workflows.
Dependencies: None.
Public Members: Product definition, platform, positioning, constraints, principles.
Side Effects: Serves as single source of product truth across all design and development passes.
=============================================================================
-->

# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web (React 18 + TypeScript + Vite + Tailwind CSS + FastAPI backend)

## Users

Personal media archive owners, photographers, creators, and privacy-conscious users who want an expansive personal photo and video vault without recurring cloud storage subscription fees.

## Product Purpose

Tellery delivers a zero-storage-cost personal media preservation and instant streaming gallery. It bridges private Telegram channels (as an uncompressed, unlimited  cloud warehouse) with a local SQLite metadata catalog and a modern, high-performance web storefront. Success means managing 100,000+ high-resolution photos and 4K videos with Google Photos-grade fluidity, instant seekable streaming, and complete data ownership.

## Positioning

Unlike conventional cloud storage (Google Photos / iCloud / Dropbox) that charges recurring monthly storage fees, and unlike basic Telegram file bots that only serve download links or media players, Tellery provides a true visual archive experience: automated SHA-256 deduplication, EXIF timeline organization, local WebP thumbnail caching, multi-select bulk workflows, virtual folder/album hierarchies, keyset cursor pagination, and HTTP 206 chunk-aligned video seeking.

## Operating Context

- **Environment**: Self-hosted local or private network server (FastAPI backend + Vite React SPA).
- **Storage Tier**: Telegram MTProto channel utilizing orce_document=True to preserve bit-for-bit uncompressed originals.
- **Workflow**: In-browser zero-config onboarding wizard; automated recursive local directory ingestion via CLI and drag-and-drop web uploads; instant timeline exploration with 100k+ keyset windowing; multi-select album organization; right-click contextual management; soft-delete trash recovery; and seekable playback.

## Capabilities and Constraints

- **Capabilities**:
  - Uncompressed raw media vault in private Telegram channels.
  - Multi-Vault channel switching with strict channel isolation and role permission gating.
  - 100,000+ keyset cursor pagination with sub-millisecond timeline queries.
  - O(log N) SHA-256 duplicate rejection with zero network overhead.
  - Deep EXIF metadata parsing and chronological timeline scrubber.
  - Local high-efficiency WebP thumbnail cache with auto-rotation.
  - Seekable HTTP 206 partial content streaming aligned to MTProto chunk boundaries.
  - Virtual Folders and Albums (zero byte duplication across albums).
  - Multi-select system with floating action toolbar and batch operations.
  - Soft-delete Trash & Data Recovery with 10-second interactive undo countdown.
  - Animated MP4 video profile avatars for channels and user accounts.
  - 10 VS Code-style color themes with OLED pure black and WCAG 2.2 AA contrast.
  - Battery Saver mode for GPU/CPU conservation.
- **Constraints**:
  - Telegram MTProto upload rate limits (defensive throttle to prevent FloodWait).
  - Web client relies on modern HTML5 video/image codecs.

## Brand Commitments

- **Name**: Tellery (Gallery Vault)
- **Aesthetic Direction**: Pro Flat Obsidian craft (Apple / Linear-inspired precision, hairline borders, rich typography, pure OLED black #000000, and 10 dynamic color themes).
- **Tone**: Fast, reliable, archival-grade, frictionless.

## Evidence on Hand

- Fully operational backend in Python (FastAPI + Telethon + SQLite WAL mode).
- Functional React 18 + TypeScript + Vite + Tailwind CSS frontend.
- Production build passing with 0 errors (
pm run build).

## Product Principles

1. **Zero-Duplication Integrity**: Files are stored once in the vault; albums, tags, and views are lightweight relational pointers.
2. **Instant Fluidity**: Heavy operations (thumbnails, caching, search indexes) are pre-calculated; UI never blocks or stutters during timeline scrolling or video seeking.
3. **Desktop-Grade Interaction**: Support rich keyboard shortcuts, multi-selection, drag-and-drop, and contextual menus equivalent to native file managers.
4. **Resilient Archival**: Maintain byte-for-byte exactness for all preserved media.
