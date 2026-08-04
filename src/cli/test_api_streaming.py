"""
=============================================================================
Module: src.cli.test_api_streaming
Purpose: Automated verification script for FastAPI REST endpoints and HTTP 206 Range streaming.
Used by: CLI developer testing (Phase 3 milestone validation).
Dependencies: httpx, asyncio, src.api.app, src.database.connection, src.storage.telegram_client
Public Members: main(), test_api_and_streaming()
Side Effects: Sends HTTP requests to internal FastAPI ASGI application, fetches MTProto stream slices.
=============================================================================
"""

import asyncio
import sys
from httpx import ASGITransport, AsyncClient
from src.api.app import create_app
from src.database.connection import init_db
from src.storage.telegram_client import get_telegram_client

# Ensure UTF-8 output encoding for Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


async def test_api_and_streaming() -> bool:
    """
    Executes automated tests against FastAPI application:
    1. Health check endpoint.
    2. Stats endpoint.
    3. Timeline listing endpoint.
    4. WebP thumbnail endpoint with Cache-Control verification.
    5. Full media stream (HTTP 200).
    6. Partial media Range stream (HTTP 206 Partial Content) with byte-level verification.
    """
    print("\n" + "=" * 70)
    print("      TeleGallery Phase 3 — API & HTTP 206 Range Streaming Test")
    print("=" * 70)

    # 1. Initialize environment
    await init_db()
    client = get_telegram_client()
    await client.start()

    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as http:
        # Test 1: Health Check
        print("\n[1/6] Testing GET /api/health...")
        res = await http.get("/api/health")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        print(f"      [PASS] Health check: {res.json()}")

        # Test 2: Archive Stats
        print("\n[2/6] Testing GET /api/media/stats...")
        res = await http.get("/api/media/stats")
        assert res.status_code == 200
        stats = res.json()
        print(f"      [PASS] Stats: {stats['total_items']} items ({stats['total_photos']} photos, {stats['total_videos']} videos, {stats['total_size_formatted']})")

        # Test 3: Timeline Catalog
        print("\n[3/6] Testing GET /api/media...")
        res = await http.get("/api/media?limit=10")
        assert res.status_code == 200
        timeline = res.json()
        total_items = timeline["total_count"]
        print(f"      [PASS] Found {total_items} items grouped into {len(timeline['groups'])} timeline period(s).")
        assert total_items > 0, "Expected at least 1 media item in database"

        first_item = timeline["groups"][0]["items"][0]
        media_id = first_item["id"]
        file_size = first_item["file_size"]
        print(f"      Target test media: ID={media_id}, Name='{first_item['file_name']}', Size={file_size} bytes")

        # Test 4: WebP Thumbnail
        if first_item.get("thumbnail_url"):
            print(f"\n[4/6] Testing GET /api/media/{media_id}/thumbnail...")
            res = await http.get(f"/api/media/{media_id}/thumbnail")
            assert res.status_code == 200
            assert res.headers.get("content-type") == "image/webp"
            assert "public, max-age=" in res.headers.get("cache-control", "")
            print(f"      [PASS] WebP thumbnail served ({len(res.content)} bytes, Content-Type: image/webp)")
        else:
            print(f"\n[4/6] Skipping thumbnail test (item has no thumbnail)")

        # Test 5: Full Stream (HTTP 200)
        print(f"\n[5/6] Testing GET /api/media/{media_id}/stream (Full file)...")
        res = await http.get(f"/api/media/{media_id}/stream")
        assert res.status_code == 200
        assert int(res.headers.get("content-length", 0)) == file_size
        assert res.headers.get("accept-ranges") == "bytes"
        assert len(res.content) == file_size
        print(f"      [PASS] Full stream: {len(res.content)} bytes received (HTTP 200 OK)")

        # Test 6: HTTP 206 Partial Content Range Requests
        print(f"\n[6/6] Testing HTTP 206 Range seeking (bytes=0-100 and bytes=50-250)...")
        
        # Range 0-100 (101 bytes)
        range_res = await http.get(f"/api/media/{media_id}/stream", headers={"Range": "bytes=0-100"})
        assert range_res.status_code == 206, f"Expected 206 Partial Content, got {range_res.status_code}"
        assert len(range_res.content) == 101, f"Expected 101 bytes, got {len(range_res.content)}"
        assert range_res.headers.get("content-range") == f"bytes 0-100/{file_size}"
        assert range_res.headers.get("content-length") == "101"
        assert range_res.content == res.content[0:101], "Range bytes do not match original file bytes!"
        print(f"      [PASS] Range bytes=0-100: Exactly 101 bytes matched byte-for-byte!")

        # Range 50-250 (201 bytes seeking in middle)
        range_res_mid = await http.get(f"/api/media/{media_id}/stream", headers={"Range": "bytes=50-250"})
        assert range_res_mid.status_code == 206
        assert len(range_res_mid.content) == 201
        assert range_res_mid.headers.get("content-range") == f"bytes 50-250/{file_size}"
        assert range_res_mid.content == res.content[50:251], "Mid-range bytes do not match original file bytes!"
        print(f"      [PASS] Range bytes=50-250 (seekable partial): Exactly 201 bytes matched byte-for-byte!")

    print("\n" + "=" * 70)
    print("  [SUCCESS] ALL REST & HTTP 206 STREAMING TESTS PASSED 100%!")
    print("=" * 70 + "\n")
    return True


def main() -> None:
    """CLI test entrypoint."""
    success = asyncio.run(test_api_and_streaming())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
