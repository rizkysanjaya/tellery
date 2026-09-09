"""
=============================================================================
Module: src.services.auth_service
Purpose: Telegram MTProto interactive authentication state machine, OTP verification,
         2FA cloud password management, session lifecycle, and 1-click vault provisioning.
         Validates API credentials to prevent blacklisted desktop keys (2040) from breaking MTProto flows.
         Guarantees proper routing to Welcome & Vault Strategy Hub on login, and clears active vault on logout.
Used by: src.api.routes.auth, src.api.app, src.api.routes.vaults
Dependencies: telethon, src.storage.telegram_client, src.services.vault_service, src.config
Public Members: AuthService, get_auth_service()
Side Effects: Performs MTProto network calls to Telegram servers, reads/writes session files and .env.
=============================================================================
"""

import asyncio
import logging
import os
from pathlib import Path
import re
from typing import Any, Optional
from telethon.errors import (
    ApiIdInvalidError,
    FloodWaitError,
    PasswordHashInvalidError,
    PhoneCodeExpiredError,
    PhoneCodeInvalidError,
    PhoneNumberBannedError,
    PhoneNumberInvalidError,
    SessionPasswordNeededError,
)
from telethon.tl.functions.channels import CreateChannelRequest
from telethon.tl.types import Channel

from src.config import get_settings
from src.services.vault_service import get_vault_service
from src.storage.telegram_client import TelegramStorageClient, get_telegram_client

logger = logging.getLogger(__name__)

BLOCKED_OR_DUMMY_API_IDS = {0, 2040, 12345678}
BLOCKED_OR_DUMMY_API_HASHES = {"", "b1844dda5045e8e4585d827ddf3f6de3"}


class AuthService:
    """
    State machine and coordinator for interactive Telegram onboarding and session auth.
    Supports in-browser credential setup, SMS/Telegram OTP verification, 2FA passwords,
    and automatic 1-click private vault channel creation.
    """

    def __init__(self, telegram_client: Optional[TelegramStorageClient] = None) -> None:
        self.telegram_client = telegram_client or get_telegram_client()
        self._pending_phone: Optional[str] = None
        self._pending_phone_code_hash: Optional[str] = None
        self._pending_step: Optional[str] = None

    async def get_auth_status(self) -> dict[str, Any]:
        """
        Evaluates current Telegram client and session status.
        Returns the active onboarding step:
        - 'need_credentials': API ID or Hash is missing or blacklisted.
        - 'need_phone': Client connected, awaiting phone number.
        - 'need_code': Verification code dispatched to user, awaiting OTP.
        - 'need_password': Two-factor (2FA) cloud password required.
        - 'need_vault': Authenticated, but no storage channel selected/created yet.
        - 'ready': Fully authenticated and connected to an active vault.
        """
        settings = get_settings()
        curr_api_id = self.telegram_client.api_id
        curr_api_hash = (self.telegram_client.api_hash or "").strip()

        has_credentials = bool(
            curr_api_id
            and curr_api_hash
            and curr_api_id not in BLOCKED_OR_DUMMY_API_IDS
            and curr_api_hash not in BLOCKED_OR_DUMMY_API_HASHES
        )

        if not has_credentials or self._pending_step == "need_credentials":
            return {
                "is_authenticated": False,
                "step": "need_credentials",
                "has_credentials": False,
                "user": None,
                "active_vault": None,
                "message": "Telegram API ID and API Hash from my.telegram.org are required to connect.",
            }

        # Check if authorized
        is_authorized = await self.telegram_client.is_authorized()
        if not is_authorized:
            if self._pending_step in ("need_code", "need_password"):
                return {
                    "is_authenticated": False,
                    "step": self._pending_step,
                    "has_credentials": True,
                    "phone": self._pending_phone,
                    "phone_code_hash": self._pending_phone_code_hash,
                    "user": None,
                    "active_vault": None,
                    "message": "Awaiting verification code or 2FA password.",
                }
            return {
                "is_authenticated": False,
                "step": "need_phone",
                "has_credentials": True,
                "user": None,
                "active_vault": None,
                "message": "Enter your Telegram phone number to receive a login code.",
            }

        # User is authorized, check user profile & active vault
        raw_client = self.telegram_client.raw_client
        user_info = None
        if raw_client:
            try:
                me = await raw_client.get_me()
                if me:
                    user_info = {
                        "id": me.id,
                        "first_name": me.first_name,
                        "last_name": me.last_name,
                        "username": me.username,
                        "phone": me.phone,
                    }
            except Exception as e:
                logger.warning(f"Failed to fetch authorized user profile: {e}")

        # Check active vault
        vault_service = get_vault_service()
        active_vault = None
        active_channel_id = vault_service.get_active_channel_id()

        if active_channel_id:
            try:
                vaults = await vault_service.discover_vaults()
                for v in vaults:
                    if v["id"] == active_channel_id:
                        active_vault = v
                        break
            except Exception as e:
                logger.warning(f"Could not discover vaults: {e}")

        if not active_vault:
            return {
                "is_authenticated": True,
                "step": "need_vault",
                "has_credentials": True,
                "user": user_info,
                "active_vault": None,
                "message": "Authenticated. Please select or create a storage vault channel.",
            }

        return {
            "is_authenticated": True,
            "step": "ready",
            "has_credentials": True,
            "user": user_info,
            "active_vault": active_vault,
            "message": "TeleGallery is fully authenticated and ready.",
        }

    def save_credentials(self, api_id: int, api_hash: str) -> dict[str, Any]:
        """
        Persists Telegram API ID & Hash and reconfigures the Telegram client.
        """
        if not api_id or not api_hash or not api_hash.strip():
            raise ValueError("Both API ID and API Hash are required.")

        clean_hash = api_hash.strip()
        if api_id in BLOCKED_OR_DUMMY_API_IDS or clean_hash in BLOCKED_OR_DUMMY_API_HASHES:
            raise ValueError(
                "The public Telegram Desktop credentials (API ID 2040) are blocked by Telegram servers for third-party clients. Please register your own free API ID & Hash at https://my.telegram.org."
            )

        self._update_env_file({"TG_API_ID": str(api_id), "TG_API_HASH": clean_hash})

        # Update running settings and reinitialize client
        settings = get_settings()
        settings.tg_api_id = api_id
        settings.tg_api_hash = clean_hash

        self.telegram_client.reinitialize(api_id=api_id, api_hash=clean_hash)
        self._pending_step = "need_phone"

        return {
            "status": "success",
            "step": "need_phone",
            "message": "Credentials saved successfully. Please proceed with phone authentication.",
        }

    async def send_phone_code(self, phone: str) -> dict[str, Any]:
        """
        Initiates MTProto phone login request via Telethon send_code_request.
        """
        raw_client = self.telegram_client.raw_client
        if not raw_client:
            raise RuntimeError("Telegram client is not configured with API credentials.")

        digits_only = re.sub(r"\D", "", phone or "")
        if not digits_only or len(digits_only) < 5:
            raise ValueError("A valid phone number with country code is required (e.g. +1234567890).")

        if not raw_client.is_connected():
            await raw_client.connect()

        clean_phone = re.sub(r"[^\d+]", "", phone)
        if not clean_phone.startswith("+"):
            clean_phone = "+" + clean_phone

        try:
            sent_code = await raw_client.send_code_request(clean_phone)
            self._pending_phone = clean_phone
            self._pending_phone_code_hash = sent_code.phone_code_hash
            self._pending_step = "need_code"

            return {
                "status": "success",
                "step": "need_code",
                "phone": clean_phone,
                "phone_code_hash": sent_code.phone_code_hash,
                "timeout": getattr(sent_code, "timeout", 120),
                "message": f"Verification code sent to {clean_phone} via Telegram/SMS.",
            }
        except ApiIdInvalidError:
            self._pending_step = "need_credentials"
            logger.error("Telegram server rejected API credentials with ApiIdInvalidError")
            raise ValueError(
                "The Telegram API ID or Hash is invalid or has been blocked by Telegram. Please provide valid credentials from https://my.telegram.org."
            )
        except PhoneNumberInvalidError:
            raise ValueError("The phone number entered is invalid. Please check the international country code.")
        except PhoneNumberBannedError:
            raise ValueError("This phone number is banned from Telegram.")
        except FloodWaitError as e:
            raise RuntimeError(f"Telegram FloodWait: Please wait {e.seconds} seconds before requesting a new code.")
        except Exception as e:
            logger.error(f"Error sending phone code request: {e}")
            raise RuntimeError(f"Failed to send verification code: {e}")

    async def verify_phone_code(self, code: str, phone_code_hash: Optional[str] = None) -> dict[str, Any]:
        """
        Submits OTP code to Telegram MTProto sign_in. Detects if 2FA password is required.
        """
        clean_code = code.strip() if code else ""
        if not clean_code:
            raise ValueError("Verification code is required.")

        raw_client = self.telegram_client.raw_client
        if not raw_client:
            raise RuntimeError("Telegram client is not configured with API credentials.")

        target_phone = self._pending_phone
        target_hash = phone_code_hash or self._pending_phone_code_hash

        if not target_phone or not target_hash:
            raise ValueError("No active phone verification request found. Please request a new code first.")

        try:
            await raw_client.sign_in(
                phone=target_phone,
                code=clean_code,
                phone_code_hash=target_hash,
            )
            # Successfully authenticated!
            self._pending_step = None
            self._pending_phone = None
            self._pending_phone_code_hash = None

            status = await self.get_auth_status()
            return {
                "status": "success",
                "step": "need_vault",
                "user": status["user"],
                "message": "Successfully authenticated with Telegram!",
            }
        except SessionPasswordNeededError:
            self._pending_step = "need_password"
            return {
                "status": "need_password",
                "step": "need_password",
                "message": "Two-Step Verification (2FA) is enabled on this account. Please enter your cloud password.",
            }
        except (PhoneCodeInvalidError, PhoneCodeExpiredError):
            raise ValueError("The verification code entered is invalid or has expired.")
        except Exception as e:
            logger.error(f"Error verifying phone code: {e}")
            raise RuntimeError(f"Failed to verify code: {e}")

    async def verify_2fa_password(self, password: str) -> dict[str, Any]:
        """
        Submits 2FA Two-Step Verification cloud password.
        """
        if not password or not password.strip():
            raise ValueError("2FA cloud password is required.")

        raw_client = self.telegram_client.raw_client
        if not raw_client:
            raise RuntimeError("Telegram client is not configured with API credentials.")

        try:
            await raw_client.sign_in(password=password.strip())
            self._pending_step = None
            self._pending_phone = None
            self._pending_phone_code_hash = None

            status = await self.get_auth_status()
            return {
                "status": "success",
                "step": "need_vault",
                "user": status["user"],
                "message": "Two-factor authentication verified successfully!",
            }
        except PasswordHashInvalidError:
            raise ValueError("Incorrect 2FA cloud password. Please try again.")
        except Exception as e:
            logger.error(f"Error verifying 2FA password: {e}")
            raise RuntimeError(f"Failed to verify password: {e}")

    async def create_storage_vault(self, title: str, about: Optional[str] = None) -> dict[str, Any]:
        """
        Creates a dedicated private Telegram storage channel and sets it as the active vault.
        """
        if not title or not title.strip():
            raise ValueError("Vault channel title is required.")

        clean_title = title.strip()
        clean_about = about.strip() if about else "Personal unlimited media storage vault powered by TeleGallery."

        raw_client = self.telegram_client.raw_client
        if not raw_client:
            raise RuntimeError("Telegram client is not configured with API credentials.")

        is_authorized = await self.telegram_client.is_authorized()
        if not is_authorized:
            raise RuntimeError("User is not authenticated. Please log in before creating a vault.")

        try:
            result = await raw_client(
                CreateChannelRequest(
                    title=clean_title,
                    about=clean_about,
                    megagroup=False,
                )
            )

            created_channel = None
            for chat in result.chats:
                if isinstance(chat, Channel):
                    created_channel = chat
                    break

            if not created_channel:
                raise RuntimeError("Failed to resolve created channel entity from Telegram response.")

            # Telegram channel IDs in Telethon: convert to standard negative storage format -100{id}
            channel_id = int(f"-100{created_channel.id}")

            # Persist to .env
            self._update_env_file({"TG_CHANNEL_ID": str(channel_id)})

            # Update settings and vault service
            settings = get_settings()
            settings.tg_channel_id = channel_id

            vault_service = get_vault_service()
            vault_service.set_active_channel_id(channel_id)

            # Invalidate cached dialogs to force immediate discovery of the new channel
            await vault_service.discover_vaults(force_refresh=True)

            return {
                "status": "success",
                "channel_id": channel_id,
                "title": clean_title,
                "message": f"Successfully created private storage vault '{clean_title}'.",
            }
        except Exception as e:
            logger.error(f"Failed to create storage vault: {e}")
            raise RuntimeError(f"Failed to create storage channel: {e}")

    async def logout(self) -> dict[str, Any]:
        """
        Logs out of Telegram session, cleans up local session files, and resets memory state.
        """
        raw_client = self.telegram_client.raw_client
        if raw_client and raw_client.is_connected():
            try:
                await raw_client.log_out()
            except Exception as e:
                logger.warning(f"Exception during raw client log_out: {e}")

        await self.telegram_client.stop()

        # Remove local session files if present
        session_path = Path("data") / f"{self.telegram_client.session_name}.session"
        if session_path.exists():
            try:
                session_path.unlink(missing_ok=True)
            except Exception as e:
                logger.warning(f"Could not delete session file: {e}")

        self._pending_phone = None
        self._pending_phone_code_hash = None
        self._pending_step = None

        # Clear active vault from settings, memory, and .env
        settings = get_settings()
        settings.tg_channel_id = None
        vault_service = get_vault_service()
        vault_service.set_active_channel_id(None)
        vault_service._cached_vaults = []
        self._remove_keys_from_env_file({"TG_CHANNEL_ID"})

        return {
            "status": "success",
            "message": "Logged out successfully. Please re-authenticate to use TeleGallery.",
        }

    def _remove_keys_from_env_file(self, keys_to_remove: set[str]) -> None:
        """
        Safely removes specific keys from the .env file while preserving other variables and comments.
        """
        env_path = Path(".env")
        if not env_path.exists():
            return
        try:
            lines = env_path.read_text(encoding="utf-8").splitlines()
        except Exception:
            return

        new_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                k, _ = stripped.split("=", 1)
                if k.strip() in keys_to_remove:
                    continue
            new_lines.append(line)

        env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

    def _update_env_file(self, updates: dict[str, str]) -> None:
        """
        Safely updates or appends key-value pairs in the .env file without destroying other variables.
        """
        env_path = Path(".env")
        lines: list[str] = []
        if env_path.exists():
            try:
                lines = env_path.read_text(encoding="utf-8").splitlines()
            except Exception:
                lines = []

        updated_keys = set()
        new_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                k, _ = stripped.split("=", 1)
                k = k.strip()
                if k in updates:
                    new_lines.append(f"{k}={updates[k]}")
                    updated_keys.add(k)
                    continue
            new_lines.append(line)

        for k, v in updates.items():
            if k not in updated_keys:
                new_lines.append(f"{k}={v}")

        env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


_auth_service_instance: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    """Returns singleton instance of AuthService."""
    global _auth_service_instance
    if _auth_service_instance is None:
        _auth_service_instance = AuthService()
    return _auth_service_instance
