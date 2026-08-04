"""
=============================================================================
Module: src.services.hasher
Purpose: Cryptographic SHA-256 hash calculation for file deduplication and integrity.
Used by: src.services.archive_service, src.cli.verify_pipeline
Dependencies: hashlib, pathlib
Public Members: compute_file_sha256, compute_bytes_sha256
Side Effects: Reads file bytes from filesystem in fixed 64KB chunks.
=============================================================================
"""

import hashlib
from pathlib import Path
from typing import Union


def compute_file_sha256(
    file_path: Union[str, Path], chunk_size: int = 65536
) -> tuple[str, int]:
    """
    Computes SHA-256 hex digest and total byte size of a file in streaming chunks.
    Maintains O(1) flat memory footprint regardless of file size.

    Args:
        file_path: Path to target file.
        chunk_size: Read buffer size in bytes (default: 64KB).

    Returns:
        tuple[str, int]: (sha256_hex_digest, total_file_size_bytes)
    """
    hasher = hashlib.sha256()
    total_bytes = 0
    target = Path(file_path)

    with open(target, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)
            total_bytes += len(chunk)

    return hasher.hexdigest(), total_bytes


def compute_bytes_sha256(data: bytes) -> str:
    """Computes SHA-256 hex digest for an in-memory byte buffer."""
    return hashlib.sha256(data).hexdigest()
