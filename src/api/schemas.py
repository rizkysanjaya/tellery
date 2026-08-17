"""
=============================================================================
Module: src.api.schemas
Purpose: Pydantic schemas and serialization models for TeleGallery REST API.
Used by: src.api.routes.media, src.api.routes.stream, src.api.routes.folders.
Dependencies: pydantic, typing
Public Members: MediaItemResponse, TimelineGroup, TimelineResponse, StatsResponse,
                FolderResponse, CreateFolderRequest, AddMediaToFolderRequest
Side Effects: None
=============================================================================
"""

from typing import Optional
from pydantic import BaseModel, Field


class MediaItemResponse(BaseModel):
    """Normalized response schema for an individual media item."""

    id: int
    file_name: str
    file_size: int
    mime_type: str
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    date_taken: Optional[str] = None
    thumbnail_url: Optional[str] = None
    stream_url: str
    created_at: str
    folder_id: Optional[int] = None
    folder_name: Optional[str] = None


class TimelineGroup(BaseModel):
    """Group of media items belonging to a single calendar period (e.g. Month/Year)."""

    period: str = Field(description="Formatted timeline heading, e.g. 'August 2026'")
    period_key: str = Field(description="ISO period key, e.g. '2026-08'")
    count: int
    items: list[MediaItemResponse]


class TimelineResponse(BaseModel):
    """Paginated timeline feed containing period-grouped media items."""

    total_count: int
    has_more: bool
    groups: list[TimelineGroup]


class StatsResponse(BaseModel):
    """Overview statistics for the entire TeleGallery archive."""

    total_items: int
    total_photos: int
    total_videos: int
    total_size_bytes: int
    total_size_formatted: str


class FolderResponse(BaseModel):
    """Folder / Album representation including item count and cover preview."""

    id: int
    name: str
    parent_id: Optional[int] = None
    item_count: int = 0
    cover_thumbnail_url: Optional[str] = None
    created_at: str


class CreateFolderRequest(BaseModel):
    """Payload for creating a new virtual folder or album."""

    name: str = Field(min_length=1, max_length=100, description="Folder display name")
    parent_id: Optional[int] = Field(None, description="Optional parent folder ID")


class AddMediaToFolderRequest(BaseModel):
    """Payload for assigning one or more media items to a folder."""

    media_ids: list[int] = Field(min_length=1, description="List of media IDs to assign")
