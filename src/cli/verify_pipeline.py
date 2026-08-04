"""
=============================================================================
Module: src.cli.verify_pipeline
Purpose: End-to-end verification script for Telegram storage & byte-for-byte integrity.
Used by: CLI developer testing (MVP 1 milestone validation).
Dependencies: src.database, src.services.archive_service, src.storage, Pillow
Public Members: main(), run_verification_pipeline()
Side Effects: Creates test image on disk, uploads to Telegram channel, writes SQLite DB.
=============================================================================
"""

import asyncio
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw
from src.config import get_settings
from src.database.connection import init_db
from src.services.archive_service import ArchiveService
from src.storage.telegram_client import TelegramStorageClient

# Ensure UTF-8 output encoding for Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def create_synthetic_test_image(output_path: Path) -> Path:
    """Generates a unique synthetic test image with timestamp for verification."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (800, 600), color=(26, 32, 44))
    draw = ImageDraw.Draw(img)

    timestamp_str = datetime.now(timezone.utc).isoformat()
    draw.rectangle([50, 50, 750, 550], outline=(66, 153, 225), width=4)
    draw.text(
        (80, 80),
        "TeleGallery Storage Verification Test",
        fill=(255, 255, 255),
    )
    draw.text((80, 120), f"Generated: {timestamp_str}", fill=(203, 213, 224))
    draw.text((80, 160), "Testing uncompressed bit-for-bit document upload...", fill=(72, 187, 120))

    # Add pseudo-random pattern to guarantee unique entropy
    for i in range(10):
        draw.line(
            [(80, 220 + i * 30), (720, 220 + i * 30)],
            fill=(45 + i * 15, 55 + i * 10, 72 + i * 12),
            width=2,
        )

    img.save(output_path, "PNG", optimize=False)
    return output_path


async def run_verification_pipeline() -> bool:
    """
    Executes full verification workflow:
    1. Verify credentials configuration.
    2. Initialize SQLite database and tables.
    3. Generate test media file.
    4. Archive test file to Telegram channel.
    5. Test deduplication detection.
    6. Retrieve bytes from Telegram and assert SHA-256 equality.
    """
    settings = get_settings()

    print("\n" + "=" * 70)
    print("      TeleGallery MVP 1 - Storage & Integrity Verification")
    print("=" * 70)

    # 1. Check Configuration
    if not settings.tg_api_id or not settings.tg_api_hash or not settings.tg_channel_id:
        print("\n[ERROR] Missing Telegram credentials.")
        print("Please configure your .env file with:")
        print("  TG_API_ID=<your_api_id>")
        print("  TG_API_HASH=<your_api_hash>")
        print("  TG_CHANNEL_ID=<your_private_channel_id>")
        print("See .env.example for a complete template.\n")
        return False

    print(f"[*] Target Channel ID: {settings.tg_channel_id}")
    print(f"[*] SQLite Database Path: {settings.db_path}")

    # 2. Initialize Database
    print("\n[1/4] Initializing SQLite database (WAL mode)...")
    await init_db()
    print("      Database schema initialized successfully.")

    # 3. Create synthetic test media
    temp_dir = Path("data/test_temp")
    test_file = temp_dir / f"test_verification_{int(time.time())}.png"
    print(f"\n[2/4] Generating synthetic test media: {test_file.name}...")
    create_synthetic_test_image(test_file)
    file_size_kb = os.path.getsize(test_file) / 1024
    print(f"      Created test image ({file_size_kb:.2f} KB).")

    # 4. Initialize MTProto & Archive Service
    print("\n[3/4] Connecting to Telegram MTProto and uploading raw document...")
    client = TelegramStorageClient()
    archive_service = ArchiveService(telegram_client=client)

    try:
        await client.start()
        entity = await client.get_target_entity(settings.tg_channel_id)
        entity_id = getattr(entity, "id", getattr(entity, "channel_id", getattr(entity, "chat_id", str(settings.tg_channel_id))))
        entity_title = getattr(entity, "title", getattr(entity, "username", str(entity_id)))
        print(f"      Connected to Telegram. Target Entity: '{entity_title}' (ID: {entity_id})")

        start_time = time.time()
        upload_result = await archive_service.archive_file(test_file)
        upload_duration = time.time() - start_time

        print(f"      Status: {upload_result['status'].upper()}")
        print(f"      Telegram Message ID: {upload_result['telegram_message_id']}")
        print(f"      SHA-256 Hash: {upload_result['file_hash']}")
        print(f"      Upload Time: {upload_duration:.2f}s ({file_size_kb / max(upload_duration, 0.001):.1f} KB/s)")

        # Test Deduplication
        print("\n      Testing instant deduplication check...")
        dedup_start = time.time()
        dedup_result = await archive_service.archive_file(test_file)
        dedup_duration = time.time() - dedup_start

        if dedup_result["status"] == "duplicate":
            print(f"      [PASS] Deduplication intercepted duplicate upload in {dedup_duration * 1000:.2f}ms.")
        else:
            print("      [FAIL] Deduplication check did not trigger.")
            return False

        # 5. Retrieve and verify byte-for-byte integrity
        print("\n[4/4] Retrieving document directly from Telegram & verifying checksum...")
        verify_start = time.time()
        is_valid, report = await archive_service.verify_media_integrity(upload_result["media_id"])
        verify_duration = time.time() - verify_start

        print(f"      Download & Verification Time: {verify_duration:.2f}s")
        print(f"      Expected SHA-256:   {report['expected_hash']}")
        print(f"      Downloaded SHA-256: {report['downloaded_hash']}")
        print(f"      Expected Size:      {report['expected_bytes']} bytes")
        print(f"      Downloaded Size:    {report['downloaded_bytes']} bytes")

        print("\n" + "=" * 70)
        if is_valid:
            print("  [SUCCESS] VERIFICATION PASSED: Byte-for-byte SHA-256 match! (100% lossless)")
            print("=" * 70 + "\n")
            return True
        else:
            print("  [FAILED] VERIFICATION FAILED: Checksums or byte counts do not match.")
            print("=" * 70 + "\n")
            return False

    finally:
        await client.stop()
        # Clean up temporary local test file
        if test_file.exists():
            test_file.unlink()


def main() -> None:
    """CLI entrypoint."""
    success = asyncio.run(run_verification_pipeline())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
