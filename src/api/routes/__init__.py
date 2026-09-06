"""
=============================================================================
Module: src.api.routes.__init__
Purpose: API routes subpackage initializer exporting APIRouters.
Used by: src.api.app
Dependencies: src.api.routes.media, src.api.routes.thumbnails, src.api.routes.stream,
              src.api.routes.folders, src.api.routes.sync, src.api.routes.vaults, src.api.routes.auth
Public Members: media_router, thumbnail_router, stream_router, folders_router, sync_router, system_router, vaults_router, auth_router
Side Effects: None
=============================================================================
"""

from src.api.routes.auth import router as auth_router
from src.api.routes.folders import router as folders_router
from src.api.routes.media import router as media_router
from src.api.routes.stream import router as stream_router
from src.api.routes.sync import router as sync_router
from src.api.routes.system import router as system_router
from src.api.routes.thumbnails import router as thumbnail_router
from src.api.routes.vaults import router as vaults_router

__all__ = [
    "auth_router",
    "media_router",
    "thumbnail_router",
    "stream_router",
    "folders_router",
    "sync_router",
    "system_router",
    "vaults_router",
]
