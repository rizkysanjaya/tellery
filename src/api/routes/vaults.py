"""
=============================================================================
Module: src.api.routes.vaults
Purpose: REST API endpoints for discovering Telegram vaults/channels, switching active vault,
         and inspecting role permissions (Owner vs Viewer).
Used by: src.api.app, frontend/src/api.ts
Dependencies: fastapi, pydantic, src.services.vault_service, src.services.sync_service
Public Members: router, list_vaults(), get_active_vault(), set_active_vault(), sync_vault()
Side Effects: Calls Telegram MTProto dialog discovery, sets active channel ID, triggers sync.
=============================================================================
"""

import logging
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from src.services.sync_service import get_sync_service
from src.services.vault_service import get_vault_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vaults", tags=["Vaults & Channels"])


class SetActiveVaultRequest(BaseModel):
    channel_id: int = Field(..., description="Telegram channel ID (-100...) to activate")


@router.get("", status_code=status.HTTP_200_OK)
async def list_vaults(refresh: bool = Query(default=False, description="Force re-querying Telegram dialogs")):
    """
    Discovers all accessible Telegram storage channels and supergroups,
    determines user permissions (Owner vs Viewer), and returns storage metrics.
    """
    vault_service = get_vault_service()
    vaults = await vault_service.discover_vaults(force_refresh=refresh)
    return {
        "status": "success",
        "total": len(vaults),
        "vaults": vaults,
    }


@router.get("/active", status_code=status.HTTP_200_OK)
async def get_active_vault():
    """
    Returns the currently active vault and its permission capabilities.
    """
    vault_service = get_vault_service()
    active_id = vault_service.get_active_channel_id()
    if active_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active vault is currently configured.",
        )

    vaults = await vault_service.discover_vaults()
    for v in vaults:
        if v["id"] == active_id:
            return {"status": "success", "vault": v}

    # Fallback if active channel not in discovered list
    perms = await vault_service.get_vault_permissions(active_id)
    stats = await vault_service.repository.get_stats(channel_id=active_id)
    return {
        "status": "success",
        "vault": {
            "id": active_id,
            "title": f"Vault {active_id}",
            "role": perms.get("role", "viewer"),
            "can_upload": perms.get("can_upload", False),
            "can_delete": perms.get("can_delete", False),
            "is_active": True,
            "media_count": stats.get("total_items", 0),
            "total_size_bytes": stats.get("total_size_bytes", 0),
        },
    }


@router.post("/active", status_code=status.HTTP_200_OK)
async def set_active_vault(payload: SetActiveVaultRequest):
    """
    Switches the globally active Telegram vault for subsequent queries and uploads.
    """
    vault_service = get_vault_service()
    vault_service.set_active_channel_id(payload.channel_id)
    perms = await vault_service.get_vault_permissions(payload.channel_id)
    stats = await vault_service.repository.get_stats(channel_id=payload.channel_id)

    return {
        "status": "success",
        "message": f"Switched active vault to channel {payload.channel_id}",
        "channel_id": payload.channel_id,
        "role": perms.get("role", "viewer"),
        "can_upload": perms.get("can_upload", False),
        "can_delete": perms.get("can_delete", False),
        "media_count": stats.get("total_items", 0),
        "total_size_bytes": stats.get("total_size_bytes", 0),
    }


@router.post("/{channel_id}/sync", status_code=status.HTTP_200_OK)
async def sync_specific_vault(
    channel_id: int,
    limit: Optional[int] = Query(default=None, ge=1, le=100000),
    full_scan: bool = Query(default=False),
):
    """
    Triggers synchronization for a specific Telegram vault.
    """
    sync_service = get_sync_service()
    if sync_service.get_status().get("is_syncing"):
        return {
            "status": "already_running",
            "message": "Synchronization is already in progress.",
        }

    stats = await sync_service.sync_channel_history(channel_id=channel_id, limit=limit, full_scan=full_scan)
    return {
        "status": "success",
        "message": f"Sync completed for channel {channel_id}.",
        "stats": stats,
    }
