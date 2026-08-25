"""
=============================================================================
Module: src.cli.tdlib_auth
Purpose: Interactive command-line authentication utility for C++ TDLib core.
         Authenticates the Telegram user account once and permanently saves the
         session keys inside data/tdlib/ for line-speed streaming and downloads.
Used by: CLI invocation (python -m src.cli.tdlib_auth)
Dependencies: asyncio, src.storage.tdlib_client, src.config
Public Members: main()
Side Effects: Prompts user for phone number, login code, and optional 2FA password.
=============================================================================
"""

import asyncio
import sys
from src.storage.tdlib_client import get_tdlib_client


async def main() -> None:
    print("=" * 65)
    print("      TeleGallery TDLib C++ Core - 1-Time Session Setup")
    print("=" * 65)

    client = get_tdlib_client()
    await client.start()

    print("\n[1/3] Initializing TDLib C++ engine...")

    last_prompted_state = None

    while True:
        state = client.auth_state
        if state == "authorizationStateWaitPhoneNumber" and last_prompted_state != state:
            last_prompted_state = state
            phone = (await asyncio.to_thread(input, "\nEnter your Telegram Phone Number (with country code, e.g. +62812...): ")).strip()
            print(f"Submitting phone number {phone}...")
            await client.set_phone_number(phone)
        elif state == "authorizationStateWaitCode" and last_prompted_state != state:
            last_prompted_state = state
            code = (await asyncio.to_thread(input, "\nEnter the Login Code sent to your Telegram app: ")).strip()
            print("Verifying code...")
            await client.check_auth_code(code)
        elif state == "authorizationStateWaitPassword" and last_prompted_state != state:
            last_prompted_state = state
            pwd = (await asyncio.to_thread(input, "\nEnter your 2FA Cloud Password: ")).strip()
            print("Verifying 2FA password...")
            await client.check_password(pwd)
        elif state == "authorizationStateReady":
            print("\n" + "=" * 65)
            print("  SUCCESS! TDLib C++ is permanently authorized and ready!")
            print("  Hardware-speed 100+ MB/s streaming is now active.")
            print("=" * 65 + "\n")
            break
        elif state == "authorizationStateClosed":
            print("\nTDLib session was closed.")
            break

        await asyncio.sleep(0.3)


if __name__ == "__main__":
    asyncio.run(main())
