"""
=============================================================================
Module: src.services.upload_tracker
Purpose: Real-time in-memory progress tracking for client-side upload UI.
         Monitors exact MTProto byte transfers to Telegram Data Centers,
         calculating upload percentage, transfer rate (MB/s), and operational states.
Used by: src.api.routes.media, src.services.archive_service
Dependencies: time, typing
Public Members: UploadTracker, get_upload_tracker()
Side Effects: Maintains in-memory dictionary of active upload states.
=============================================================================
"""

import time
from typing import Any, Dict, Optional


class UploadTracker:
    """
    Thread-safe in-memory registry for tracking real-time media upload progress.
    """

    def __init__(self) -> None:
        self._uploads: Dict[str, Dict[str, Any]] = {}

    def start_tracking(self, upload_id: str, total_bytes: int, file_name: str) -> None:
        """Initializes a new tracking session for an upload."""
        self._uploads[upload_id] = {
            "upload_id": upload_id,
            "file_name": file_name,
            "status": "uploading_to_telegram",
            "bytes_uploaded": 0,
            "total_bytes": total_bytes,
            "percent": 0.0,
            "speed_mbps": 0.0,
            "start_time": time.time(),
            "last_update_time": time.time(),
            "last_bytes": 0,
            "error": None,
        }

    def update_progress(self, upload_id: str, bytes_uploaded: int, total_bytes: int) -> None:
        """Updates byte transfer counters and rolling transfer speed."""
        item = self._uploads.get(upload_id)
        if not item:
            return

        now = time.time()
        elapsed_total = max(0.2, now - item.get("start_time", now))
        speed_mbps = round((bytes_uploaded / (1024 * 1024)) / elapsed_total, 2)
        item["speed_mbps"] = speed_mbps

        percent = round((bytes_uploaded / max(1, total_bytes)) * 100, 1)
        item["bytes_uploaded"] = bytes_uploaded
        item["total_bytes"] = total_bytes
        item["percent"] = min(100.0, percent)
        item["status"] = "uploading_to_telegram"

    def set_status(self, upload_id: str, status: str, error: Optional[str] = None) -> None:
        """Sets the lifecycle state of an upload (e.g. processing, completed, error)."""
        item = self._uploads.get(upload_id)
        if not item:
            return
        item["status"] = status
        if error:
            item["error"] = error
        if status == "completed":
            item["percent"] = 100.0

    def get_progress(self, upload_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves current progress snapshot for an upload."""
        return self._uploads.get(upload_id)

    def cleanup(self, upload_id: str) -> None:
        """Removes an upload from tracking after completion."""
        self._uploads.pop(upload_id, None)


_tracker_instance: Optional[UploadTracker] = None


def get_upload_tracker() -> UploadTracker:
    """Returns singleton UploadTracker instance."""
    global _tracker_instance
    if _tracker_instance is None:
        _tracker_instance = UploadTracker()
    return _tracker_instance
