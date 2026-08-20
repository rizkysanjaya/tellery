"""
=============================================================================
Module: src.api.routes.sync
Purpose: REST API endpoints for Telegram Channel synchronization & real-time status.
Used by: src.api.app, frontend/src/api.ts
Dependencies: fastapi, pydantic, src.services.sync_service
Public Members: router, trigger_sync(), get_sync_status()
Side Effects: Triggers background Telegram channel scans and updates database catalog.
=============================================================================
"""

from typing import Any, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, Field
from src.services.sync_service import get_sync_service

router = APIRouter(prefix="/api/sync", tags=["Vault Synchronization"])


class SyncRequest(BaseModel):
    limit: int = Field(default=200, ge=1, le=1000, description="Max messages to scan in channel")
    full_scan: bool = Field(default=False, description="Scan full history instead of early-stopping incremental sync")


@router.post("", status_code=status.HTTP_200_OK)
async def trigger_sync(payload: SyncRequest = SyncRequest()):
    """
    Triggers synchronization with the Telegram Storage Channel.
    Ingests any photos, videos, and raw documents posted directly from mobile/desktop Telegram.
    """
    sync_service = get_sync_service()
    if sync_service.get_status().get("is_syncing"):
        return {
            "status": "already_running",
            "message": "Synchronization is already in progress.",
            "stats": sync_service.get_status().get("last_sync_stats"),
        }

    stats = await sync_service.sync_channel_history(
        limit=payload.limit,
        full_scan=payload.full_scan,
    )
    return {
        "status": "success",
        "message": f"Sync completed. Added {stats.get('added', 0)} new items.",
        "stats": stats,
    }


@router.get("/status", status_code=status.HTTP_200_OK)
async def get_sync_status():
    """
    Returns current sync progress, real-time background listener health, and last sync results.
    """
    sync_service = get_sync_service()
    return sync_service.get_status()
