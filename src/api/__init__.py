"""
=============================================================================
Module: src.api.__init__
Purpose: API package initializer for TeleGallery REST and Streaming endpoints.
Used by: src.main, FastAPI server runners.
Dependencies: src.api.app
Public Members: create_app
Side Effects: None
=============================================================================
"""

from src.api.app import create_app

__all__ = ["create_app"]
