"""
=============================================================================
Module: src.api.routes.folders
Purpose: REST endpoints for creating, managing, organizing, renaming, and customizing folders, icons, and favorites.
Used by: Web UI Album views, Lightbox folder assignment drawer, Sidebar, and Action menus.
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
    UpdateFolderColorRequest,
    UpdateFolderRequest,
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
        color=f.get("color"),
        icon=f.get("icon") or "Folder",
        is_favorite=bool(f.get("is_favorite", 0)),
        is_collection=bool(f.get("is_collection", 0)),
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
    Creates a new virtual folder or album. Prevents duplicate folder names.
    """
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Album name cannot be empty")

    existing = await MediaRepository.get_folder_by_name(clean_name, payload.parent_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'An album named "{clean_name}" already exists.'
        )

    folder_id = await MediaRepository.create_folder(
        name=clean_name,
        parent_id=payload.parent_id,
        color=payload.color,
        icon=payload.icon or "Folder",
        is_favorite=1 if payload.is_favorite else 0,
        is_collection=1 if payload.is_collection else 0,
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


@router.patch("/{folder_id:int}", response_model=FolderResponse)
async def update_folder(folder_id: int, payload: UpdateFolderRequest):
    """
    Partially updates a folder: rename, change icon, update color, toggle favorite, or move collection.
    """
    folder = await MediaRepository.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # If renaming, verify uniqueness
    if payload.name is not None:
        clean_name = payload.name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Album name cannot be empty")
        existing = await MediaRepository.get_folder_by_name(clean_name, folder.get("parent_id"))
        if existing and existing["id"] != folder_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'An album named "{clean_name}" already exists.'
            )

    fav_int = (1 if payload.is_favorite else 0) if payload.is_favorite is not None else None
    parent_sentinel = payload.parent_id if "parent_id" in payload.model_fields_set else -999

    await MediaRepository.update_folder(
        folder_id=folder_id,
        name=payload.name,
        color=payload.color,
        icon=payload.icon,
        is_favorite=fav_int,
        parent_id=parent_sentinel,
    )
    updated = await MediaRepository.get_folder(folder_id)
    return _to_folder_response(updated)


@router.patch("/{folder_id:int}/color", response_model=FolderResponse)
async def update_folder_color(folder_id: int, payload: UpdateFolderColorRequest):
    """
    Updates the icon color of a folder. Send color=null to reset to default.
    """
    folder = await MediaRepository.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    await MediaRepository.update_folder_color(folder_id, payload.color)
    updated = await MediaRepository.get_folder(folder_id)
    return _to_folder_response(updated)


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
