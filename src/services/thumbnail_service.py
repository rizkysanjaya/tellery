"""
=============================================================================
Module: src.services.thumbnail_service
Purpose: High-performance local WebP thumbnail generation & disk caching for
         both images (Pillow EXIF-aware) and videos (OpenCV frame extraction),
         plus ultra-lightweight animated WebP preview generation for instant 0ms video hover.
Used by: src.services.archive_service, src.services.sync_service, src.cli.import_folder, FastAPI thumbnail/preview routes.
Dependencies: PIL.Image, PIL.ImageOps, cv2, io, pathlib, src.config
Public Members: generate_thumbnail(), generate_image_thumbnail(), generate_video_thumbnail(),
                generate_thumbnail_from_bytes(), generate_video_preview()
Side Effects: Reads source media file from disk/bytes, creates and saves WebP thumbnail/preview in .thumbnails/.
=============================================================================
"""

import io
from pathlib import Path
from typing import Optional, Union
import cv2
from PIL import Image, ImageOps
from src.config import get_settings


def generate_thumbnail_from_bytes(
    data: bytes,
    file_hash: str,
    max_dimension: int = 480,
    quality: int = 80,
) -> Optional[str]:
    """
    Generates a high-quality, compact WebP thumbnail directly from image bytes in memory.
    Useful for ingesting Telegram photo/document previews without saving full raw files to disk.
    """
    settings = get_settings()
    thumb_dir = settings.thumbnails_path
    target_thumb_file = thumb_dir / f"{file_hash}.webp"

    # Require >= 1200 bytes to ensure file is a full-resolution thumbnail, not an ultra-low-res placeholder
    if target_thumb_file.exists() and target_thumb_file.stat().st_size >= 1200:
        return str(target_thumb_file.as_posix())

    try:
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode in ("RGBA", "LA", "P"):
                if img.mode == "P":
                    img = img.convert("RGBA")
            elif img.mode != "RGB":
                img = img.convert("RGB")

            img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            target_thumb_file.parent.mkdir(parents=True, exist_ok=True)
            img.save(target_thumb_file, "WEBP", quality=quality, method=4)
            return str(target_thumb_file.as_posix())
    except Exception as e:
        print(f"[Thumbnail] Failed to generate thumbnail from bytes for hash {file_hash}: {e}")
        return None


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


def generate_video_preview(
    file_path: Union[str, Path],
    file_hash: str,
    max_dimension: int = 320,
    num_frames: int = 12,
    quality: int = 70,
) -> Optional[str]:
    """
    Extracts 10-12 keyframes from the first 2.5 seconds of a video and encodes them
    into an ultra-lightweight (~80-150 KB) looping animated WebP file.
    Enables instant 0ms hover preview in the frontend without streaming full multi-MB videos.
    """
    settings = get_settings()
    thumb_dir = settings.thumbnails_path
    target_preview_file = thumb_dir / f"{file_hash}_preview.webp"

    if target_preview_file.exists() and target_preview_file.stat().st_size > 0:
        return str(target_preview_file.as_posix())

    source_path = Path(file_path)
    if not source_path.exists():
        return None

    cap = None
    try:
        cap = cv2.VideoCapture(str(source_path))
        if not cap.isOpened():
            return None

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 1)

        # Sample across the first 2.5 seconds (or full video if shorter)
        sample_duration_frames = min(total_frames, int(fps * 2.5))
        if sample_duration_frames < 2:
            return None

        step = max(1, sample_duration_frames // num_frames)
        frames: list[Image.Image] = []

        for i in range(0, sample_duration_frames, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if not ret or frame is None:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
            pil_img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            frames.append(pil_img)

        if not frames:
            return None

        target_preview_file.parent.mkdir(parents=True, exist_ok=True)
        frames[0].save(
            target_preview_file,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=125,  # 8 fps animation
            loop=0,
            quality=quality,
            method=4,
        )
        return str(target_preview_file.as_posix())
    except Exception as e:
        print(f"[Thumbnail] Failed to generate video preview for {file_hash}: {e}")
        return None
    finally:
        if cap is not None:
            cap.release()

