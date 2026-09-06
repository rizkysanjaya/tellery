"""
=============================================================================
Module: src.api.routes.auth
Purpose: REST API endpoints for Telegram MTProto interactive authentication,
         onboarding state polling, OTP verification, 2FA password validation,
         1-click vault creation, and session logout.
Used by: src.api.app, frontend/src/api.ts
Dependencies: fastapi, pydantic, src.services.auth_service, src.services.vault_service
Public Members: router, get_auth_status(), save_credentials(), send_phone_code(),
                verify_phone_code(), verify_2fa_password(), create_vault(), logout()
Side Effects: Executes MTProto authentication calls, reads/writes session files and .env.
=============================================================================
"""

import logging
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from src.services.auth_service import get_auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication & Onboarding"])


class CredentialsRequest(BaseModel):
    api_id: int = Field(..., description="Telegram API ID from my.telegram.org")
    api_hash: str = Field(..., description="Telegram API Hash from my.telegram.org")


class SendCodeRequest(BaseModel):
    phone: str = Field(..., description="International phone number (e.g. +628123456789)")


class VerifyCodeRequest(BaseModel):
    code: str = Field(..., description="5-digit Telegram verification code")
    phone_code_hash: Optional[str] = Field(None, description="Phone code hash returned by send_code")


class VerifyPasswordRequest(BaseModel):
    password: str = Field(..., description="Two-Step Verification (2FA) cloud password")


class CreateVaultRequest(BaseModel):
    title: str = Field("TeleGallery Cloud Vault", description="Title for new private storage channel")
    about: Optional[str] = Field("Personal unlimited media storage vault", description="Description for new channel")


@router.get("/status")
async def get_auth_status() -> dict[str, Any]:
    """
    Returns current Telegram client and session status, indicating which onboarding step is required:
    - 'need_credentials'
    - 'need_phone'
    - 'need_code'
    - 'need_password'
    - 'need_vault'
    - 'ready'
    """
    auth_service = get_auth_service()
    try:
        return await auth_service.get_auth_status()
    except Exception as e:
        logger.error(f"Error checking auth status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check authentication status: {e}",
        )


@router.post("/credentials")
async def save_credentials(body: CredentialsRequest) -> dict[str, Any]:
    """
    Saves Telegram API ID and Hash into application configuration and reconfigures the MTProto client.
    """
    auth_service = get_auth_service()
    try:
        return auth_service.save_credentials(api_id=body.api_id, api_hash=body.api_hash)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/send_code")
async def send_phone_code(body: SendCodeRequest) -> dict[str, Any]:
    """
    Sends verification code to user's Telegram phone number.
    """
    auth_service = get_auth_service()
    try:
        return await auth_service.send_phone_code(phone=body.phone)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS if "FloodWait" in str(e) else status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/verify_code")
async def verify_phone_code(body: VerifyCodeRequest) -> dict[str, Any]:
    """
    Verifies the OTP code sent to user. If 2FA is active, prompts for cloud password.
    """
    auth_service = get_auth_service()
    try:
        return await auth_service.verify_phone_code(code=body.code, phone_code_hash=body.phone_code_hash)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/verify_password")
async def verify_2fa_password(body: VerifyPasswordRequest) -> dict[str, Any]:
    """
    Verifies Two-Step Verification (2FA) cloud password.
    """
    auth_service = get_auth_service()
    try:
        return await auth_service.verify_2fa_password(password=body.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/create_vault")
async def create_vault(body: CreateVaultRequest) -> dict[str, Any]:
    """
    Automatically creates a dedicated private Telegram storage channel and sets it as the active vault.
    """
    auth_service = get_auth_service()
    try:
        return await auth_service.create_storage_vault(title=body.title, about=body.about)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/logout")
async def logout() -> dict[str, Any]:
    """
    Logs out of Telegram session and clears local session cache.
    """
    auth_service = get_auth_service()
    try:
        return await auth_service.logout()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
