"""
=============================================================================
Module: src.config
Purpose: Configuration and environment variables management for Tellery.
         Gracefully handles empty strings in .env by coercing optional integer IDs to None.
Used by: src.storage.telegram_client, src.database.connection, src.services.auth_service, CLI runners.
Dependencies: pydantic, pydantic_settings, dotenv, pathlib
Public Members: Settings, get_settings()
Side Effects: Reads environment variables from .env file and process env.
=============================================================================
"""

from functools import lru_cache
from pathlib import Path
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Telegram MTProto Credentials
    tg_api_id: Optional[int] = None
    tg_api_hash: Optional[str] = None
    tg_channel_id: Optional[int] = None
    tg_session_name: str = "telegallery_session"

    @field_validator("tg_api_id", "tg_channel_id", mode="before")
    @classmethod
    def coerce_empty_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

    # SQLite Database Configuration
    db_path: str = "data/telegallery.db"

    # Upload and Transfer Settings
    upload_chunk_size_kb: int = 512
    max_concurrent_uploads: int = 2

    # Thumbnail and Local Cache Directories
    thumbnails_dir: str = ".thumbnails"

    @property
    def db_file_path(self) -> Path:
        """Returns Path object for database file and ensures parent dir exists."""
        path = Path(self.db_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def thumbnails_path(self) -> Path:
        """Returns Path object for thumbnails directory and ensures it exists."""
        path = Path(self.thumbnails_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Returns singleton cached instance of application settings."""
    return Settings()
