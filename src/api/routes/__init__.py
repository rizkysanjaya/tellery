"""
=============================================================================
Module: src.api.routes.__init__
Purpose: API routes subpackage initializer exporting APIRouters.
Used by: src.api.app
Dependencies: src.api.routes.media, src.api.routes.thumbnails, src.api.routes.stream
Public Members: media_router, thumbnail_router, stream_router
Side Effects: None
=============================================================================
"""

from src.api.routes.media import router as media_router
from src.api.routes.thumbnails import router as thumbnail_router
from src.api.routes.stream import router as stream_router

__all__ = ["media_router", "thumbnail_router", "stream_router"]
