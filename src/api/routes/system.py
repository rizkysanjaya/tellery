"""
=============================================================================
Module: src.api.routes.system
Purpose: System telemetry, local disk cache management, and storage diagnostics.
         Provides REST endpoints for inspecting storage metrics and triggering
         immediate cache purges to reclaim local disk space.
Used by: src.api.app, frontend/src/components/Sidebar, frontend/src/api
Dependencies: fastapi, src.services.stream_cache, src.database.connection
Public Members: router
Side Effects: Deletes cached stream media files on disk during purge requests.
=============================================================================
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.services.stream_cache import get_stream_cache
from src.database.connection import get_db_connection

router = APIRouter(prefix="/api/system", tags=["system"])


class CacheLimitRequest(BaseModel):
    max_bytes: int


@router.get("/cache")
async def get_cache_info():
    """
    Returns live statistics on local stream cache size, ceiling limit,
    percent utilized, and cached item count.
    """
    cache = get_stream_cache()
    return cache.get_cache_stats()


@router.post("/cache/limit")
async def update_cache_limit(req: CacheLimitRequest):
    """
    Updates the runtime maximum stream cache ceiling limit.
    """
    if req.max_bytes < 100 * 1024 * 1024:  # Minimum 100 MB
        raise HTTPException(status_code=400, detail="Minimum cache limit is 100 MB")
    cache = get_stream_cache()
    cache.max_cache_bytes = req.max_bytes
    return cache.get_cache_stats()


@router.delete("/cache")
async def clear_cache():
    """
    Purges 100% of non-in-flight stream cache files from local disk,
    instantly reclaiming local drive storage.
    """
    cache = get_stream_cache()
    result = cache.clear_all_cache()
    return {
        "status": "success",
        "message": f"Purged {result['files_deleted']} cached files ({result['freed_formatted']} reclaimed)",
        **result,
    }


@router.get("/stats")
async def get_system_stats():
    """
    Aggregates vault catalog metrics: total cloud media count, total cloud storage size,
    and local cache utilization.
    """
    cache = get_stream_cache()
    cache_stats = cache.get_cache_stats()

    async with get_db_connection() as db:
        async with db.execute("SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM media_items WHERE is_deleted = 0") as cursor:
            row = await cursor.fetchone()
            total_items = row[0] if row else 0
            total_cloud_bytes = row[1] if row else 0

    return {
        "total_media_items": total_items,
        "total_cloud_bytes": total_cloud_bytes,
        "total_cloud_formatted": cache._format_bytes(total_cloud_bytes),
        "local_cache": cache_stats,
    }
