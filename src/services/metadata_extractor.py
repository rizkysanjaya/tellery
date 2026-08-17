"""
=============================================================================
Module: src.services.metadata_extractor
Purpose: Deep media metadata and EXIF parser (photos & videos) for timeline indexing.
Used by: src.services.archive_service, src.cli.import_folder.
Dependencies: PIL.Image, PIL.ExifTags, mimetypes, pathlib, datetime
Public Members: extract_media_metadata(), MediaMetadata
Side Effects: Reads header bytes of media files from disk.
=============================================================================
"""

import mimetypes
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Union
from PIL import ExifTags, Image


@dataclass
class MediaMetadata:
    """Extracted technical and contextual metadata from a media file."""

    file_name: str
    file_size: int
    mime_type: str
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    date_taken: Optional[str] = None  # ISO8601 string


def _parse_exif_date(date_str: str) -> Optional[str]:
    """Parses standard EXIF date format 'YYYY:MM:DD HH:MM:SS' into ISO8601."""
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        # Standard EXIF format: '2024:08:15 14:30:00'
        dt = datetime.strptime(date_str.strip(), "%Y:%m:%d %H:%M:%S")
        return dt.isoformat()
    except Exception:
        try:
            # Fallback ISO or variant
            dt = datetime.fromisoformat(date_str.strip())
            return dt.isoformat()
        except Exception:
            return None


def extract_media_metadata(file_path: Union[str, Path]) -> MediaMetadata:
    """
    Extracts dimensions, EXIF capture date, camera specs, and MIME type.
    Falls back gracefully on non-image or unparseable files without crashing.

    Args:
        file_path: Path to target media file.

    Returns:
        MediaMetadata dataclass with extracted attributes.
    """
    path_obj = Path(file_path)
    file_size = path_obj.stat().st_size
    mime_type, _ = mimetypes.guess_type(path_obj.name)
    mime_type = mime_type or "application/octet-stream"

    # Default fallback capture time: file modification time
    fallback_time = datetime.fromtimestamp(
        path_obj.stat().st_mtime, tz=timezone.utc
    ).isoformat()

    metadata = MediaMetadata(
        file_name=path_obj.name,
        file_size=file_size,
        mime_type=mime_type,
        date_taken=fallback_time,
    )

    # If it is an image, attempt deep EXIF parsing via Pillow
    if mime_type.startswith("image/"):
        try:
            with Image.open(path_obj) as img:
                metadata.width, metadata.height = img.size

                # Extract EXIF tags
                exif_data = img.getexif()
                if exif_data:
                    # Resolve numeric EXIF tags to human-readable names
                    exif = {
                        ExifTags.TAGS.get(tag, tag): val
                        for tag, val in exif_data.items()
                    }

                    # Camera make & model
                    if "Make" in exif and isinstance(exif["Make"], str):
                        metadata.camera_make = exif["Make"].strip()
                    if "Model" in exif and isinstance(exif["Model"], str):
                        metadata.camera_model = exif["Model"].strip()

                    # Capture timestamps (DateTimeOriginal > DateTimeDigitized > DateTime)
                    raw_date = (
                        exif.get("DateTimeOriginal")
                        or exif.get("DateTimeDigitized")
                        or exif.get("DateTime")
                    )
                    parsed_date = _parse_exif_date(raw_date) if raw_date else None
                    if parsed_date:
                        metadata.date_taken = parsed_date

                    # Handle EXIF orientation transposition
                    orientation = exif.get("Orientation")
                    if orientation in (5, 6, 7, 8):
                        # 90 or 270 degree rotation swaps width & height
                        metadata.width, metadata.height = metadata.height, metadata.width
        except Exception:
            # Non-fatal error; keep basic metadata
            pass

    # If it is a video, extract resolution and duration via OpenCV
    elif mime_type.startswith("video/"):
        try:
            import cv2

            cap = cv2.VideoCapture(str(path_obj))
            if cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = cap.get(cv2.CAP_PROP_FPS)
                frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)

                if w > 0 and h > 0:
                    metadata.width = w
                    metadata.height = h
                if fps and fps > 0 and frame_count and frame_count > 0:
                    metadata.duration_seconds = round(frame_count / fps, 2)

                cap.release()
        except Exception:
            pass

    return metadata
