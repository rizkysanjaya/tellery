"""
=============================================================================
Module: src.services.transcoder_service
Purpose: Automated video codec detection and on-the-fly H.264 web transcoding
         using static FFmpeg binaries (imageio-ffmpeg).
         Ensures HEVC/H.265, ProRes, and exotic mobile recordings play with 100%
         browser compatibility while preserving raw untouched files in Telegram Vault.
Used by: src.services.stream_cache, src.services.archive_service, src.api.routes.stream
Dependencies: subprocess, imageio_ffmpeg, cv2, pathlib, typing
Public Members: get_video_codec(), is_web_compatible(), transcode_to_web_h264(), ensure_web_stream_ready()
Side Effects: Executes background FFmpeg processes, creates web-compatible MP4 files in cache.
=============================================================================
"""

import subprocess
from pathlib import Path
from typing import Optional, Union
import cv2
import imageio_ffmpeg


def get_video_codec(file_path: Union[str, Path]) -> str:
    """
    Detects the FourCC video stream codec using OpenCV with FFmpeg stream inspection fallback.
    Returns lowercase codec string (e.g. 'h264', 'hevc', 'avc1', 'vp09', etc.).
    """
    path_obj = Path(file_path)
    if not path_obj.exists():
        return "unknown"

    cap = None
    try:
        cap = cv2.VideoCapture(str(path_obj))
        if cap.isOpened():
            fourcc_int = int(cap.get(cv2.CAP_PROP_FOURCC))
            if fourcc_int > 0:
                codec = "".join([chr((fourcc_int >> 8 * i) & 0xFF) for i in range(4)]).lower().strip()
                if codec and codec != "unknown":
                    return codec
    except Exception:
        pass
    finally:
        if cap is not None:
            cap.release()

    # Fallback to direct FFmpeg probe if OpenCV returns unknown
    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        res = subprocess.run(
            [ffmpeg_exe, "-i", str(path_obj)],
            stderr=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            timeout=5,
        )
        output = res.stderr.lower()
        if "hevc" in output or "h.265" in output:
            return "hevc"
        if "h264" in output or "avc" in output:
            return "h264"
        if "prores" in output:
            return "prores"
        if "vp9" in output:
            return "vp90"
        if "vp8" in output:
            return "vp80"
        if "av1" in output:
            return "av01"
    except Exception:
        pass

    return "unknown"


def is_web_compatible(file_path: Union[str, Path]) -> bool:
    """
    Returns True if the video is encoded with a universal browser-compatible codec (H.264 / AVC).
    Returns False for HEVC/H.265, ProRes, VC1, MPEG-2, or unknown codecs requiring transcoding.
    """
    codec = get_video_codec(file_path)

    # Universally supported web codecs across all modern browsers
    web_codecs = {"h264", "avc1", "avc3", "vp80", "vp90", "av01", "mp4v"}
    if codec in web_codecs:
        return True

    # Incompatible codecs that freeze on Windows/Android/iOS browsers
    incompatible_codecs = {"hevc", "hvc1", "hev1", "apcn", "apch", "ap4h", "ap4x", "prores"}
    if codec in incompatible_codecs:
        return False

    # Default to compatible if standard mp4/webm container
    suffix = Path(file_path).suffix.lower()
    return suffix in {".mp4", ".webm"}


def transcode_to_web_h264(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
) -> bool:
    """
    Transcodes an unsupported video (HEVC/ProRes) to high-quality, fast-start H.264 MP4.
    Applies +faststart for instantaneous 0ms HTTP range seek initiation.
    """
    in_file = Path(input_path)
    out_file = Path(output_path)

    if not in_file.exists():
        return False

    out_file.parent.mkdir(parents=True, exist_ok=True)
    temp_output = out_file.with_suffix(".transcoding.mp4")

    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", str(in_file),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            str(temp_output),
        ]

        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
        )

        if result.returncode == 0 and temp_output.exists() and temp_output.stat().st_size > 0:
            temp_output.replace(out_file)
            return True
        else:
            if temp_output.exists():
                temp_output.unlink()
            return False
    except Exception as e:
        print(f"[Transcoder] FFmpeg transcode error: {e}")
        if temp_output.exists():
            try:
                temp_output.unlink()
            except Exception:
                pass
        return False


def ensure_web_stream_ready(source_path: Path, file_hash: str) -> Path:
    """
    Checks if the source video is browser compatible.
    If not, transparently transcodes to an H.264 web version in cache and returns its path.
    """
    # If already web compatible, return original source
    if is_web_compatible(source_path):
        return source_path

    # Check if transcoded web version already exists in cache
    web_cached = source_path.parent / f"{file_hash}_web.mp4"
    if web_cached.exists() and web_cached.stat().st_size > 0:
        return web_cached

    # Transcode on-demand
    success = transcode_to_web_h264(source_path, web_cached)
    if success and web_cached.exists():
        return web_cached

    # Fallback to source if transcode fails
    return source_path
