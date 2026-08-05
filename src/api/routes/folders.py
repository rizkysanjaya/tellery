"""
=============================================================================
Module: src.api.routes.folders
Purpose: REST endpoints for creating, managing, and organizing folders and albums.
Used by: Web UI Album views, Lightbox folder assignment drawer.
Dependencies: fastapi, src.database.repository, src.api.schemas
Public Members: router
Side Effects: Inserts, updates, and deletes records in folders and media_folders tables.
=============================================================================
"""

from fastapi import APIRouter, HTTPException, status
from src.api.schemas import (
    AddMediaToFolderRequest,
    CreateFolderRequest,
    FolderResponse,
)
from src.database.repository import MediaRepository

router = APIRouter(prefix="/api/folders", tags=["Folders & Albums"])


def _to_folder_response(f: dict) -> FolderResponse:
    """Formats database row into FolderResponse schema with cover thumbnail URL."""
    cover_media_id = f.get("cover_media_id")
    cover_thumb_url = (
        f"/api/media/{cover_media_id}/thumbnail" if cover_media_id else None
    )
    return FolderResponse(
        id=f["id"],
        name=f["name"],
        parent_id=f.get("parent_id"),
        item_count=f.get("item_count", 0),
        cover_thumbnail_url=cover_thumb_url,
        created_at=f["created_at"],
    )


@router.get("", response_model=list[FolderResponse])
async def list_folders():
    """
    Lists all virtual folders / albums with their media count and cover previews.
    """
    raw_folders = await MediaRepository.list_folders()
    return [_to_folder_response(f) for f in raw_folders]


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(payload: CreateFolderRequest):
    """
    Creates a new virtual folder or album.
    """
    folder_id = await MediaRepository.create_folder(
        name=payload.name,
        parent_id=payload.parent_id,
    )
    created = await MediaRepository.get_folder(folder_id)
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create folder")
    return _to_folder_response(created)


@router.get("/{folder_id:int}", response_model=FolderResponse)
async def get_folder(folder_id: int):
    """
    Retrieves a specific folder by ID.
    """
    folder = await MediaRepository.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return _to_folder_response(folder)


@router.delete("/{folder_id:int}")
async def delete_folder(folder_id: int):
    """
    Deletes a folder and removes associations without deleting the underlying media files.
    """
    folder = await MediaRepository.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    await MediaRepository.delete_folder(folder_id)
    return {"status": "deleted", "folder_id": folder_id}


@router.post("/{folder_id:int}/media")
async def add_media_to_folder(folder_id: int, payload: AddMediaToFolderRequest):
    """
    Assigns one or more media items into a folder.
    """
    folder = await MediaRepository.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    added_count = await MediaRepository.add_media_to_folder(folder_id, payload.media_ids)
    return {"status": "added", "folder_id": folder_id, "added_count": added_count}


@router.delete("/{folder_id:int}/media/{media_id:int}")
async def remove_media_from_folder(folder_id: int, media_id: int):
    """
    Removes a media item association from a folder.
    """
    folder = await MediaRepository.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    success = await MediaRepository.remove_media_from_folder(folder_id, media_id)
    if not success:
        raise HTTPException(status_code=404, detail="Media association not found in this folder")

    return {"status": "removed", "folder_id": folder_id, "media_id": media_id}
