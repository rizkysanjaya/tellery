"""
=============================================================================
Module: src.services.thumbnail_service
Purpose: High-performance local WebP thumbnail generation & disk caching for
         both images (Pillow EXIF-aware) and videos (OpenCV frame extraction).
Used by: src.services.archive_service, src.cli.import_folder, FastAPI thumbnail routes.
Dependencies: PIL.Image, PIL.ImageOps, cv2, pathlib, src.config
Public Members: generate_thumbnail(), generate_image_thumbnail(), generate_video_thumbnail()
Side Effects: Reads source media file from disk, creates and saves WebP thumbnail in storage/thumbnails.
=============================================================================
"""

from pathlib import Path
from typing import Optional, Union
import cv2
from PIL import Image, ImageOps
from src.config import get_settings


def generate_image_thumbnail(
    file_path: Union[str, Path],
    file_hash: str,
    max_dimension: int = 480,
    quality: int = 80,
) -> Optional[str]:
    """
    Generates a high-quality, compact WebP thumbnail for images.
    Applies EXIF auto-rotation and caches on local disk using the file hash.
    """
    settings = get_settings()
    thumb_dir = settings.thumbnails_path
    target_thumb_file = thumb_dir / f"{file_hash}.webp"

    # Return cached path immediately if already generated
    if target_thumb_file.exists() and target_thumb_file.stat().st_size > 0:
        return str(target_thumb_file.as_posix())

    source_path = Path(file_path)
    if not source_path.exists():
        return None

    try:
        with Image.open(source_path) as img:
            # Correct orientation from EXIF tags (portrait vs landscape)
            img = ImageOps.exif_transpose(img)

            # Convert RGBA/Palette/CMYK to RGB for consistent WebP encoding
            if img.mode in ("RGBA", "LA", "P"):
                if img.mode == "P":
                    img = img.convert("RGBA")
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # High-quality downsampling thumbnail resize
            img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

            # Save as optimized WebP
            img.save(
                target_thumb_file,
                format="WEBP",
                quality=quality,
                method=6,  # Highest compression efficiency
            )

        return str(target_thumb_file.as_posix())
    except Exception:
        return None


def generate_video_thumbnail(
    file_path: Union[str, Path],
    file_hash: str,
    max_dimension: int = 480,
    quality: int = 80,
) -> Optional[str]:
    """
    Extracts a representative video frame using OpenCV and encodes to WebP thumbnail.
    """
    settings = get_settings()
    thumb_dir = settings.thumbnails_path
    target_thumb_file = thumb_dir / f"{file_hash}.webp"

    if target_thumb_file.exists() and target_thumb_file.stat().st_size > 0:
        return str(target_thumb_file.as_posix())

    source_path = Path(file_path)
    if not source_path.exists():
        return None

    cap = None
    try:
        cap = cv2.VideoCapture(str(source_path))
        if not cap.isOpened():
            return None

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 1.0

        # Seek ~1.0 sec into the video or 10% into duration
        target_frame_idx = min(int(fps * 1.0), max(0, int(total_frames * 0.1)))
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame_idx)

        success, frame = cap.read()
        if not success or frame is None:
            # Fallback to frame 0
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            success, frame = cap.read()
            if not success or frame is None:
                return None

        # Convert BGR (OpenCV) to RGB (Pillow)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb_frame)

        # High-quality downsampling thumbnail resize
        img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

        # Save as optimized WebP
        img.save(
            target_thumb_file,
            format="WEBP",
            quality=quality,
            method=6,
        )

        return str(target_thumb_file.as_posix())
    except Exception:
        return None
    finally:
        if cap is not None:
            cap.release()


def generate_thumbnail(
    file_path: Union[str, Path],
    file_hash: str,
    mime_type: str,
    max_dimension: int = 480,
    quality: int = 80,
) -> Optional[str]:
    """
    Unified dispatcher to generate thumbnails for images or videos.
    """
    if mime_type.startswith("video/"):
        return generate_video_thumbnail(
            file_path=file_path,
            file_hash=file_hash,
            max_dimension=max_dimension,
            quality=quality,
        )
    elif mime_type.startswith("image/"):
        return generate_image_thumbnail(
            file_path=file_path,
            file_hash=file_hash,
            max_dimension=max_dimension,
            quality=quality,
        )
    return None
