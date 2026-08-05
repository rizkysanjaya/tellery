"""
=============================================================================
Module: src.cli.test_folders
Purpose: Automated verification script for Folders & Albums REST API and database integration.
Used by: CLI developer testing (Folders milestone validation).
Dependencies: httpx, asyncio, src.api.app, src.database.connection
Public Members: main(), test_folders_api()
Side Effects: Inserts, associates, and deletes virtual folders in SQLite database.
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


async def test_folders_api() -> bool:
    """
    Executes automated tests for virtual folders and album organization.
    """
    print("\n" + "=" * 70)
    print("        TeleGallery — Folders & Albums API Integration Test")
    print("=" * 70)

    await init_db()
    client = get_telegram_client()
    await client.start()

    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as http:
        # Step 1: List existing media to get test IDs
        print("\n[1/7] Fetching existing media catalog...")
        media_res = await http.get("/api/media?limit=5")
        assert media_res.status_code == 200
        media_groups = media_res.json()["groups"]
        all_media = [item for g in media_groups for item in g["items"]]
        assert len(all_media) >= 2, "Need at least 2 media items to test folder assignment"
        m1_id = all_media[0]["id"]
        m2_id = all_media[1]["id"]
        print(f"      Selected test media items: ID={m1_id} and ID={m2_id}")

        # Step 2: Create a new Folder
        print("\n[2/7] Testing POST /api/folders (Creating 'Vacation Trips 2026')...")
        create_res = await http.post("/api/folders", json={"name": "Vacation Trips 2026"})
        assert create_res.status_code == 201
        folder_data = create_res.json()
        folder_id = folder_data["id"]
        print(f"      [PASS] Created Folder: ID={folder_id}, Name='{folder_data['name']}'")

        # Step 3: Add Media to Folder
        print(f"\n[3/7] Testing POST /api/folders/{folder_id}/media (Adding media IDs {m1_id}, {m2_id})...")
        add_res = await http.post(f"/api/folders/{folder_id}/media", json={"media_ids": [m1_id, m2_id]})
        assert add_res.status_code == 200
        print(f"      [PASS] Added media response: {add_res.json()}")

        # Step 4: List Folders and verify cover thumbnail and count
        print("\n[4/7] Testing GET /api/folders...")
        list_res = await http.get("/api/folders")
        assert list_res.status_code == 200
        folders = list_res.json()
        target_folder = next((f for f in folders if f["id"] == folder_id), None)
        assert target_folder is not None, "Created folder not found in folder list"
        assert target_folder["item_count"] == 2, f"Expected 2 items, got {target_folder['item_count']}"
        print(f"      [PASS] Folder item count: {target_folder['item_count']}, Cover URL: {target_folder['cover_thumbnail_url']}")

        # Step 5: Filter Media Timeline by Folder
        print(f"\n[5/7] Testing GET /api/media?folder_id={folder_id}...")
        filtered_res = await http.get(f"/api/media?folder_id={folder_id}")
        assert filtered_res.status_code == 200
        filtered_items = [item for g in filtered_res.json()["groups"] for item in g["items"]]
        assert len(filtered_items) == 2
        print(f"      [PASS] Filtered timeline correctly returned {len(filtered_items)} items for this folder!")

        # Step 6: Get assigned folders for a media item
        print(f"\n[6/7] Testing GET /api/media/{m1_id}/folders...")
        item_folders_res = await http.get(f"/api/media/{m1_id}/folders")
        assert item_folders_res.status_code == 200
        assigned = item_folders_res.json()
        assert any(f["id"] == folder_id for f in assigned)
        print(f"      [PASS] Media ID {m1_id} is assigned to: {[f['name'] for f in assigned]}")

        # Step 7: Delete Folder
        print(f"\n[7/7] Testing DELETE /api/folders/{folder_id}...")
        del_res = await http.delete(f"/api/folders/{folder_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # Verify folder is deleted and media items still exist
        check_folder_res = await http.get(f"/api/folders/{folder_id}")
        assert check_folder_res.status_code == 404
        check_media_res = await http.get(f"/api/media/{m1_id}")
        assert check_media_res.status_code == 200, "Underlying media should NOT be deleted when folder is deleted!"
        print(f"      [PASS] Folder deleted cleanly, underlying media remains preserved in catalog!")

    print("\n" + "=" * 70)
    print("  [SUCCESS] ALL FOLDERS & ALBUMS API TESTS PASSED 100%!")
    print("=" * 70 + "\n")
    return True


def main() -> None:
    """CLI test entrypoint."""
    success = asyncio.run(test_folders_api())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
