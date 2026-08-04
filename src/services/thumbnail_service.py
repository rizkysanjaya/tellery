"""
=============================================================================
Module: src.services.thumbnail_service
Purpose: High-performance local WebP thumbnail generation & disk caching.
Used by: src.services.archive_service, src.cli.import_folder, FastAPI thumbnail routes.
Dependencies: PIL.Image, PIL.ImageOps, pathlib, src.config
Public Members: generate_image_thumbnail()
Side Effects: Reads source image file, creates and saves WebP thumbnail on local disk.
=============================================================================
"""

from pathlib import Path
from typing import Optional, Union
from PIL import Image, ImageOps
from src.config import get_settings


def generate_image_thumbnail(
    file_path: Union[str, Path],
    file_hash: str,
    max_dimension: int = 480,
    quality: int = 80,
) -> Optional[str]:
    """
    Generates a high-quality, compact WebP thumbnail for visual media.
    Applies EXIF auto-rotation and caches on local disk using the file hash.

    Args:
        file_path: Path to original source image.
        file_hash: SHA-256 hex digest used as the cache key.
        max_dimension: Longest edge resolution in pixels (default: 480px).
        quality: WebP compression quality 1-100 (default: 80).

    Returns:
        Optional[str]: Relative path to generated thumbnail file, or None if failed.
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
                # Preserve transparency if RGBA, or convert to RGB
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
        # Non-fatal error; return None if unparseable
        return None
