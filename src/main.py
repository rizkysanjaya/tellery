"""
=============================================================================
Module: src.main
Purpose: Main application entry point running Uvicorn ASGI server for Tellery.
Used by: CLI, systemd / background service launcher.
Dependencies: uvicorn, argparse, src.api.app
Public Members: main()
Side Effects: Starts HTTP server on configured host and port.
=============================================================================
"""

import argparse
import sys
import uvicorn
from src.api.app import create_app

# Ensure UTF-8 output encoding for Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

app = create_app()


def main() -> None:
    """CLI server launcher."""
    parser = argparse.ArgumentParser(description="Tellery FastAPI Server")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    parser.add_argument("--no-reload", action="store_true", help="Disable auto-reloading")

    args = parser.parse_args()
    should_reload = not args.no_reload

    print("\n" + "=" * 70)
    print("                 Tellery Archive & Streaming Server")
    print("=" * 70)
    print(f"[*] Server URL:        http://{args.host}:{args.port}")
    print(f"[*] API Documentation: http://{args.host}:{args.port}/docs")
    print(f"[*] Auto-Reload:       {'Enabled' if should_reload else 'Disabled'}")
    print("=" * 70 + "\n")

    uvicorn.run(
        "src.main:app",
        host=args.host,
        port=args.port,
        reload=should_reload,
    )


if __name__ == "__main__":
    main()
