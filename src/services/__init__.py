"""
=============================================================================
Module: src.services.__init__
Purpose: Services subpackage initializer exporting hasher, metadata, thumbnails, and archive services.
Used by: src.cli, Application entry points.
Dependencies: src.services.hasher, src.services.metadata_extractor, src.services.thumbnail_service, src.services.archive_service
Public Members: compute_file_sha256, compute_bytes_sha256, extract_media_metadata, MediaMetadata, generate_image_thumbnail, ArchiveService
Side Effects: None
=============================================================================
"""

from src.services.hasher import compute_file_sha256, compute_bytes_sha256
from src.services.metadata_extractor import extract_media_metadata, MediaMetadata
from src.services.thumbnail_service import generate_image_thumbnail
from src.services.archive_service import ArchiveService

__all__ = [
    "compute_file_sha256",
    "compute_bytes_sha256",
    "extract_media_metadata",
    "MediaMetadata",
    "generate_image_thumbnail",
    "ArchiveService",
]
