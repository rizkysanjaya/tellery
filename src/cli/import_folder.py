"""
=============================================================================
Module: src.cli.import_folder
Purpose: CLI recursive folder scanner and batch media importer for TeleGallery.
Used by: User / Developer for bulk ingestion from local disks, hard drives, and backups.
Dependencies: argparse, asyncio, pathlib, time, src.services.archive_service, src.database.connection, src.config
Public Members: main(), import_directory()
Side Effects: Reads files from disk, writes SQLite DB, uploads to Telegram MTProto, generates WebP thumbnails.
=============================================================================
"""

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path
from src.config import get_settings
from src.database.connection import init_db
from src.database.repository import MediaRepository
from src.services.archive_service import ArchiveService
from src.services.hasher import compute_file_sha256
from src.storage.telegram_client import TelegramStorageClient

# Ensure UTF-8 output encoding for Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Supported media extensions for indexing
SUPPORTED_EXTENSIONS = {
    # Images
    ".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp", ".gif", ".tiff",
    ".cr2", ".dng", ".arw", ".nef", ".raw",
    # Videos
    ".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv", ".wmv", ".m4v", ".3gp",
}

# Ignored directory names
IGNORED_DIRS = {
    ".git", ".thumbnails", "node_modules", "temp_downloads", "cache",
    "$recycle.bin", "system volume information", "__pycache__", "venv", ".venv",
}


def scan_media_files(directory_path: Path) -> list[Path]:
    """Recursively crawls directory for valid media files, ignoring system directories."""
    media_files = []
    for root, dirs, files in os.walk(directory_path):
        # Filter out ignored directories in-place
        dirs[:] = [d for d in dirs if d.lower() not in IGNORED_DIRS and not d.startswith(".")]

        for file in files:
            file_path = Path(root) / file
            if file.startswith(".") or file.startswith("~$") or file.lower() == "thumbs.db":
                continue
            if file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                media_files.append(file_path)

    return sorted(media_files)


async def import_directory(
    target_dir: Path,
    dry_run: bool = False,
    delay_seconds: float = 1.5,
) -> None:
    """
    Scans and imports all media files from a local directory into the TeleGallery archive.
    """
    settings = get_settings()

    print("\n" + "=" * 70)
    print("           TeleGallery — Local Batch Folder Importer")
    print("=" * 70)
    print(f"[*] Target Directory: {target_dir.resolve()}")
    print(f"[*] Mode: {'DRY RUN (Analysis Only)' if dry_run else 'LIVE INGESTION'}")
    print(f"[*] Target Channel: {settings.tg_channel_id}")
    print(f"[*] Upload Throttling Delay: {delay_seconds:.1f}s between files")

    if not target_dir.exists() or not target_dir.is_dir():
        print(f"\n[ERROR] Directory not found or not a directory: {target_dir}")
        return

    # 1. Initialize SQLite Database
    await init_db()

    # 2. Discover media files
    print("\n[1/3] Scanning directory for photos and videos...")
    files = scan_media_files(target_dir)
    total_files = len(files)

    if total_files == 0:
        print("      No supported media files found.")
        return

    total_bytes = sum(f.stat().st_size for f in files)
    print(f"      Found {total_files} media files ({total_bytes / (1024 * 1024):.2f} MB total).")

    # 3. Dry Run or Ingestion
    print(f"\n[2/3] Processing media items...")
    repository = MediaRepository()
    client = TelegramStorageClient() if not dry_run else None
    archive_service = ArchiveService(repository=repository, telegram_client=client)

    if client:
        await client.start()

    uploaded_count = 0
    duplicate_count = 0
    failed_count = 0
    processed_bytes = 0
    start_time = time.time()

    try:
        for idx, file_path in enumerate(files, 1):
            file_size = file_path.stat().st_size
            file_size_mb = file_size / (1024 * 1024)

            # DRY RUN: Hash and check SQLite index only
            if dry_run:
                file_hash, _ = compute_file_sha256(file_path)
                existing = await repository.get_by_hash(file_hash)
                if existing:
                    duplicate_count += 1
                    status_label = "[DEDUP - Already in Archive]"
                else:
                    uploaded_count += 1
                    status_label = "[NEW - Ready to Ingest]"

                print(f"  [{idx}/{total_files}] {file_path.name} ({file_size_mb:.2f} MB) -> {status_label}")
                processed_bytes += file_size
                continue

            # LIVE INGESTION: Archive, deduplicate, generate thumbnail, upload
            try:
                print(f"  [{idx}/{total_files}] Ingesting: {file_path.name} ({file_size_mb:.2f} MB)... ", end="", flush=True)
                result = await archive_service.archive_file(file_path)

                if result["status"] == "duplicate":
                    duplicate_count += 1
                    print(f"SKIPPED (Duplicate in DB)")
                else:
                    uploaded_count += 1
                    meta_info = []
                    if result.get("camera_model"):
                        meta_info.append(result["camera_model"])
                    if result.get("width") and result.get("height"):
                        meta_info.append(f"{result['width']}x{result['height']}")
                    meta_str = f" [{', '.join(meta_info)}]" if meta_info else ""
                    print(f"UPLOADED (Msg #{result['telegram_message_id']}){meta_str}")

                    # Polite rate limiting between Telegram uploads
                    if idx < total_files:
                        await asyncio.sleep(delay_seconds)

                processed_bytes += file_size
            except Exception as e:
                failed_count += 1
                print(f"FAILED ({e})")

    finally:
        if client:
            await client.stop()

    # 4. Summary Report
    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print("                      Ingestion Summary")
    print("=" * 70)
    print(f"  Total Scanned:    {total_files} files ({processed_bytes / (1024 * 1024):.2f} MB)")
    print(f"  New Uploads:      {uploaded_count} files")
    print(f"  Duplicates:       {duplicate_count} files (bandwidth saved!)")
    print(f"  Failed:           {failed_count} files")
    print(f"  Total Time:       {elapsed:.2f}s ({processed_bytes / (1024 * 1024) / max(elapsed, 0.001):.2f} MB/s)")
    print("=" * 70 + "\n")


def main() -> None:
    """CLI Argument Parser and Entrypoint."""
    parser = argparse.ArgumentParser(description="TeleGallery Batch Folder Importer")
    parser.add_argument("folder", type=str, help="Path to local media directory to import")
    parser.add_argument("--dry-run", action="store_true", help="Analyze and check deduplication without uploading")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay in seconds between Telegram uploads (default 1.5s)")

    args = parser.parse_args()
    target_path = Path(args.folder)

    asyncio.run(import_directory(target_path, dry_run=args.dry_run, delay_seconds=args.delay))


if __name__ == "__main__":
    main()
