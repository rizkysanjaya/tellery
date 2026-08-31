"""
=============================================================================
Module: src.api.schemas
Purpose: Pydantic schemas and serialization models for TeleGallery REST API.
Used by: src.api.routes.media, src.api.routes.stream, src.api.routes.folders.
Dependencies: pydantic, typing
Public Members: MediaItemResponse, TimelineGroup, TimelineResponse, StatsResponse,
                FolderResponse, CreateFolderRequest, AddMediaToFolderRequest,
                UpdateFolderColorRequest, FavoriteMediaRequest, BulkFavoriteMediaRequest,
                RestoreMediaBatchRequest, BatchDownloadRequest, TrashResponse,
                CameraFilterItem, PeriodSummaryItem, FilterMetadataResponse
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
    is_favorite: bool = False
    deleted_at: Optional[str] = None


class RestoreMediaBatchRequest(BaseModel):
    """Payload for batch restoring soft-deleted media items from Trash."""

    media_ids: list[int]


class BatchDownloadRequest(BaseModel):
    """Payload for downloading multiple media items as a single ZIP archive."""

    media_ids: list[int]


class TrashResponse(BaseModel):
    """Response payload for Trash list view."""

    total: int
    items: list[MediaItemResponse]


class CameraFilterItem(BaseModel):
    """Camera make/model metadata and photo counts."""

    make: str
    model: str
    label: str
    count: int


class PeriodSummaryItem(BaseModel):
    """Chronological month/year period item for timeline date-jump scrubber."""

    period_key: str
    label: str
    year: int
    count: int
    first_media_id: Optional[int] = None


class YearSummaryItem(BaseModel):
    """Year summary for high-level timeline jump."""

    year: int
    count: int


class OrientationsSummary(BaseModel):
    """Media orientation and resolution counts."""

    landscape: int
    portrait: int
    square: int
    uhd_4k: int
    fhd: int


class FilterMetadataResponse(BaseModel):
    """Aggregate EXIF and timeline metadata for smart filtering and scrubber."""

    cameras: list[CameraFilterItem]
    periods: list[PeriodSummaryItem]
    years: list[YearSummaryItem]
    orientations: OrientationsSummary


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
    account_name: Optional[str] = None
    account_username: Optional[str] = None
    channel_name: Optional[str] = None
    channel_avatar_url: Optional[str] = None
    user_avatar_url: Optional[str] = None


class FolderResponse(BaseModel):
    """Folder / Album representation including item count and cover preview."""

    id: int
    name: str
    parent_id: Optional[int] = None
    color: Optional[str] = None
    icon: Optional[str] = "Folder"
    is_favorite: bool = False
    is_collection: bool = False
    sub_album_count: int = 0
    item_count: int = 0
    cover_media_id: Optional[int] = None
    cover_thumbnail_url: Optional[str] = None
    created_at: str


class FolderMediaItemResponse(BaseModel):
    """Lightweight media item preview for album thumbnail selection."""

    id: int
    file_name: str
    mime_type: str
    file_size: int
    thumbnail_url: Optional[str] = None
    added_at: str


class CreateFolderRequest(BaseModel):
    """Payload for creating a new virtual folder or album."""

    name: str = Field(min_length=1, max_length=100, description="Folder display name")
    parent_id: Optional[int] = Field(None, description="Optional parent folder ID")
    color: Optional[str] = Field(None, description="Optional hex color string")
    icon: Optional[str] = Field("Folder", description="Optional icon identifier")
    is_favorite: Optional[bool] = Field(False, description="Pin to favorites")
    is_collection: Optional[bool] = Field(False, description="Set as collection parent")
    cover_media_id: Optional[int] = Field(None, description="Optional custom cover media ID")


class UpdateFolderRequest(BaseModel):
    """Payload for updating folder attributes (partial)."""

    name: Optional[str] = Field(None, min_length=1, max_length=100, description="New folder name")
    color: Optional[str] = Field(None, description="Hex color or empty string to reset")
    icon: Optional[str] = Field(None, description="Icon identifier e.g. 'Heart', 'Star', 'Folder'")
    is_favorite: Optional[bool] = Field(None, description="Favorite toggle")
    is_collection: Optional[bool] = Field(None, description="Collection flag toggle")
    parent_id: Optional[int] = Field(None, description="Collection / parent folder ID (or null to ungroup)")
    cover_media_id: Optional[int] = Field(None, description="Media ID to pin as thumbnail (or null to reset to latest)")


class AddMediaToFolderRequest(BaseModel):
    """Payload for assigning one or more media items to a folder."""

    media_ids: list[int] = Field(min_length=1, description="List of media IDs to assign")


class UpdateFolderColorRequest(BaseModel):
    """Payload for updating a folder's icon color. Send null to reset."""

    color: Optional[str] = Field(None, description="Hex color string e.g. '#6366f1', or null to reset")


class FavoriteMediaRequest(BaseModel):
    """Payload for toggling favorite status of a media item."""

    is_favorite: bool = Field(description="True to mark as favorite, False to unfavorite")


class BulkFavoriteMediaRequest(BaseModel):
    """Payload for batch toggling favorite status of multiple media items."""

    media_ids: list[int] = Field(min_length=1, description="List of media IDs to update")
    is_favorite: bool = Field(description="True to mark as favorite, False to unfavorite")

