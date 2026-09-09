"""
=============================================================================
Module: run.py
Purpose: 1-Command zero-friction launcher for Tellery (Gallery Vault).
         Verifies environment, ensures compiled frontend assets exist,
         launches the unified FastAPI/Uvicorn server, and opens the web browser.
Used by: End-users and developers for 1-command startup.
Dependencies: sys, os, time, threading, webbrowser, pathlib, uvicorn
Public Members: main()
Side Effects: Launches ASGI server on port 8000 and opens default web browser.
=============================================================================
"""

import os
import sys
import time
import threading
import webbrowser
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def open_browser(url: str, delay: float = 1.5) -> None:
    """Opens the user's default web browser after the server has initialized."""
    time.sleep(delay)
    try:
        webbrowser.open(url)
    except Exception:
        pass


def check_and_prepare() -> bool:
    """Verifies prerequisites and frontend build status."""
    root_dir = Path(__file__).resolve().parent
    dist_dir = root_dir / "frontend" / "dist"

    if not dist_dir.exists():
        print("[!] Frontend production build (frontend/dist) not found.")
        print("[*] Attempting to build frontend with npm...")
        frontend_dir = root_dir / "frontend"
        try:
            import subprocess
            res = subprocess.run(["npm", "run", "build"], cwd=str(frontend_dir), shell=True)
            if res.returncode != 0:
                print("[!] Frontend build failed. Please run 'cd frontend && npm install && npm run build' manually.")
                return False
        except Exception as e:
            print(f"[!] Could not invoke npm: {e}")
            return False

    return True


def main() -> None:
    """Main 1-command launcher entrypoint."""
    host = "127.0.0.1"
    port = 8000
    url = f"http://{host}:{port}"

    print("\n" + "=" * 72)
    print("      🚀 Tellery (Gallery Vault) v1.0.0 — 1-Command Launcher")
    print("=" * 72)
    print(f"[*] Web Gallery URL:   {url}")
    print(f"[*] API Documentation: {url}/docs")
    print("=" * 72 + "\n")

    check_and_prepare()

    # Launch browser in background thread
    threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    import uvicorn
    uvicorn.run("src.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
