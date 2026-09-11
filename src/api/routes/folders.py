"""
=============================================================================
Module: src.api.routes.folders
Purpose: REST endpoints for creating, managing, organizing, renaming, customizing folders,
         scoped strictly to Telegram storage channels for multi-vault isolation,
         and exporting full albums as ZIP archives with zero-copy kernel streaming.
Used by: Web UI Album views, Lightbox folder assignment drawer, Sidebar, and Action menus.
Dependencies: fastapi, typing, src.database.repository, src.api.schemas, src.services.vault_service, src.services.zip_export_service
Public Members: router, list_folders, create_folder, get_folder, delete_folder, bulk_delete_folders
Side Effects: Inserts, updates, and deletes records in folders and media_folders tables, spools temp album ZIPs.
=============================================================================
"""

from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from fastapi.responses import FileResponse
from src.api.schemas import (
    AddMediaToFolderRequest,
    BulkDeleteFoldersRequest,
    CreateFolderRequest,
    FolderMediaItemResponse,
    FolderResponse,
    UpdateFolderColorRequest,
    UpdateFolderRequest,
)
from src.database.repository import MediaRepository
from src.services.vault_service import get_vault_service
from src.services.zip_export_service import get_zip_export_service

router = APIRouter(prefix="/api/folders", tags=["Folders & Albums"])


def _to_folder_response(f: dict) -> FolderResponse:
    """Formats database row into FolderResponse schema with cover thumbnail URL."""
    cover_media_id = f.get("cover_media_id")
    cover_thumb_url = (
        f"/api/media/{cover_media_id}/thumbnail?v=2" if cover_media_id else None
    )
    return FolderResponse(
        id=f["id"],
        name=f["name"],
        parent_id=f.get("parent_id"),
        telegram_channel_id=f.get("telegram_channel_id"),
        color=f.get("color"),
        icon=f.get("icon") or ("Layers" if f.get("is_collection") else "Folder"),
        is_favorite=bool(f.get("is_favorite", 0)),
        is_collection=bool(f.get("is_collection", 0)),
        sub_album_count=f.get("sub_album_count", 0),
        item_count=f.get("item_count", 0),
        cover_media_id=cover_media_id,
        cover_thumbnail_url=cover_thumb_url,
        created_at=f["created_at"],
    )


@router.get("", response_model=list[FolderResponse])
async def list_folders(channel_id: Optional[int] = Query(None)):
    """
    Lists virtual folders / albums with their media count and cover previews,
    scoped strictly to the specified or active Telegram channel.
    """
    active_channel = channel_id or get_vault_service().get_active_channel_id()
    raw_folders = await MediaRepository.list_folders(channel_id=active_channel)
    return [_to_folder_response(f) for f in raw_folders]


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(payload: CreateFolderRequest):
    """
    Creates a new virtual folder or album scoped to the active/specified channel.
    Prevents duplicate folder names within the same channel.
    """
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Album name cannot be empty")

    target_channel = payload.channel_id or get_vault_service().get_active_channel_id()

    existing = await MediaRepository.get_folder_by_name(
        clean_name, payload.parent_id, channel_id=target_channel
    )
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
        cover_media_id=payload.cover_media_id,
        telegram_channel_id=target_channel,
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


@router.get("/{folder_id:int}/media-options", response_model=list[FolderMediaItemResponse])
async def get_folder_media_options(folder_id: int):
    """
    Lists media items inside a folder so the user can choose one as the custom album thumbnail.
    """
    folder = await MediaRepository.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    items = await MediaRepository.list_folder_media(folder_id, limit=60)
    return [
        FolderMediaItemResponse(
            id=item["id"],
            file_name=item["file_name"],
            mime_type=item["mime_type"],
            file_size=item["file_size"],
            thumbnail_url=f"/api/media/{item['id']}/thumbnail?v=2" if item.get("thumbnail_path") else None,
            added_at=item["added_at"],
        )
        for item in items
    ]


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


@router.post("/bulk-delete")
async def bulk_delete_folders(payload: BulkDeleteFoldersRequest):
    """
    Deletes multiple folders/collections in a single atomic transaction without deleting underlying media files.
    """
    deleted_count = await MediaRepository.bulk_delete_folders(payload.folder_ids)
    return {"status": "deleted", "deleted_count": deleted_count, "folder_ids": payload.folder_ids}


@router.patch("/{folder_id:int}", response_model=FolderResponse)
async def update_folder(folder_id: int, payload: UpdateFolderRequest):
    """
    Partially updates a folder: rename, change icon, update color, toggle favorite, or set thumbnail.
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
    coll_int = (1 if payload.is_collection else 0) if payload.is_collection is not None else None
    parent_sentinel = payload.parent_id if "parent_id" in payload.model_fields_set else -999
    cover_sentinel = payload.cover_media_id if "cover_media_id" in payload.model_fields_set else -999

    await MediaRepository.update_folder(
        folder_id=folder_id,
        name=payload.name,
        color=payload.color,
        icon=payload.icon,
        is_favorite=fav_int,
        is_collection=coll_int,
        parent_id=parent_sentinel,
        cover_media_id=cover_sentinel,
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


@router.get("/{folder_id:int}/export-zip")
async def export_album_as_zip(
    folder_id: int,
    background_tasks: BackgroundTasks,
):
    """
    Creates and streams a ZIP archive containing all media items in the specified album.
    Employs ZIP_STORED and kernel sendfile FileResponse to eliminate memory/CPU bloat.
    Automatically unlinks the temporary archive file upon completion.
    """
    zip_service = get_zip_export_service()
    try:
        zip_path, sanitized_name = await zip_service.create_album_archive(folder_id)
        export_filename = f"{sanitized_name}.zip"

        background_tasks.add_task(zip_service.cleanup_archive, zip_path)
        return FileResponse(
            path=zip_path,
            media_type="application/zip",
            filename=export_filename,
            background=background_tasks,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export album as zip: {e}")
