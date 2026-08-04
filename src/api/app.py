"""
=============================================================================
Module: src.api.app
Purpose: FastAPI application factory, lifespan startup/shutdown, and middleware configuration.
Used by: src.main, Uvicorn ASGI server.
Dependencies: fastapi, src.database.connection, src.storage.telegram_client, src.api.routes
Public Members: create_app()
Side Effects: Initializes DB and MTProto client on server startup, closes connection on shutdown.
=============================================================================
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import media_router, stream_router, thumbnail_router
from src.database.connection import init_db
from src.storage.telegram_client import get_telegram_client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application lifespan manager:
    - Startup: Initializes SQLite WAL database and connects Telegram MTProto client.
    - Shutdown: Disconnects Telegram client cleanly.
    """
    print("\n[*] TeleGallery Archive Engine starting up...")
    await init_db()
    telegram_client = get_telegram_client()
    await telegram_client.start()
    print("[*] Telegram MTProto Client connected.")
    print("[*] SQLite WAL Catalog initialized.")

    yield

    print("\n[*] TeleGallery Archive Engine shutting down...")
    await telegram_client.stop()
    print("[*] Telegram MTProto Client disconnected.")


def create_app() -> FastAPI:
    """Factory creating configured FastAPI application instance."""
    app = FastAPI(
        title="TeleGallery Archive & Streaming API",
        description="Personal Media Preservation & Seekable Streaming Engine powered by Telegram MTProto.",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Enable CORS for local React / Vite frontend development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API Routers
    app.include_router(media_router)
    app.include_router(thumbnail_router)
    app.include_router(stream_router)

    @app.get("/api/health", tags=["Health"])
    async def health_check():
        """Health check endpoint for monitoring."""
        return {"status": "healthy", "service": "TeleGallery Archive Engine"}

    # Mount compiled frontend if available
    from pathlib import Path
    from fastapi.staticfiles import StaticFiles

    dist_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    if dist_path.exists():
        app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="frontend")

    return app
