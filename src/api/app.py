"""
=============================================================================
Module: src.api.app
Purpose: FastAPI application factory, non-blocking lifespan startup/shutdown,
         and secure CORS middleware configuration for gallery & onboarding.
Used by: src.main, Uvicorn ASGI server.
Dependencies: fastapi, src.database.connection, src.storage.telegram_client,
              src.storage.tdlib_client, src.services.sync_service, src.api.routes
Public Members: create_app()
Side Effects: Initializes DB, MTProto client, TDLib C++ engine, and live channel sync listener on server startup.
=============================================================================
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import (
    auth_router,
    folders_router,
    media_router,
    stream_router,
    sync_router,
    system_router,
    thumbnail_router,
    vaults_router,
)
from src.database.connection import init_db
from src.services.sync_service import get_sync_service
from src.storage.telegram_client import get_telegram_client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application lifespan manager:
    - Startup: Initializes SQLite WAL database, checks Telegram MTProto authorization,
      starts high-speed C++ TDLib 16-stream hardware engine (if authorized), and registers live channel listener.
      If unauthorized, starts non-blockingly to serve in-browser onboarding wizard.
    - Shutdown: Disconnects MTProto and TDLib clients cleanly.
    """
    print("\n[*] TeleGallery Archive Engine starting up...")
    await init_db()
    print("[*] SQLite WAL Catalog initialized.")

    telegram_client = get_telegram_client()
    td_client = None

    is_auth = False
    try:
        await telegram_client.start()
        is_auth = await telegram_client.is_authorized()
    except Exception as e:
        print(f"[*] Telegram client awaiting setup: {e}")

    if is_auth:
        print("[*] Telegram MTProto Client connected and authorized.")
        # Initialize high-speed C++ TDLib Client
        from src.storage.tdlib_client import get_tdlib_client
        td_client = get_tdlib_client()
        try:
            await td_client.start()
            import asyncio
            for _ in range(60):
                if td_client.auth_state == "authorizationStateReady":
                    print("[*] TDLib C++ 16-Stream Hardware Engine connected and ready.")
                    break
                await asyncio.sleep(0.05)
        except Exception as e:
            print(f"[!] Warning: Could not initialize TDLib client: {e}")

        # Initialize Real-time Channel Listener
        sync_service = get_sync_service()
        try:
            await sync_service.setup_channel_live_listener()
        except Exception as e:
            print(f"[!] Warning: Could not initialize live Telegram channel listener: {e}")
    else:
        print("[*] Telegram Client is NOT authorized yet. Awaiting in-browser onboarding.")

    yield

    print("\n[*] TeleGallery Archive Engine shutting down...")
    if td_client:
        try:
            await td_client.close()
            print("[*] TDLib C++ Client disconnected.")
        except Exception as e:
            print(f"[!] Warning during TDLib shutdown: {e}")
    try:
        await telegram_client.stop()
        print("[*] Telegram MTProto Client disconnected.")
    except Exception as e:
        print(f"[!] Warning during MTProto shutdown: {e}")


def create_app() -> FastAPI:
    """
    Creates and configures the FastAPI application instance.
    Configures CORS, lifespan handlers, and registers modular API routers.
    """
    app = FastAPI(
        title="Tellery (Gallery Vault) Archive API",
        description="High-performance zero-cost photo and video cloud archive using Telegram MTProto as remote document warehouse.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Enable secure CORS for React / Vite frontend development and production hosting
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API Routers
    app.include_router(auth_router)
    app.include_router(media_router)
    app.include_router(thumbnail_router)
    app.include_router(stream_router)
    app.include_router(folders_router)
    app.include_router(sync_router)
    app.include_router(system_router)
    app.include_router(vaults_router)

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
