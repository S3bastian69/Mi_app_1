"""Servidor local de App Converter con tipos MIME compatibles con modulos web."""

from __future__ import annotations

import argparse
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class AppHandler(SimpleHTTPRequestHandler):
    """Sirve la PWA sin cachear el codigo durante el desarrollo local."""

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self) -> None:
        if self.path.endswith(("/", ".html", ".js", ".mjs", ".css", ".webmanifest")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor local de App Converter")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()

    mimetypes.add_type("text/javascript", ".mjs")
    mimetypes.add_type("application/manifest+json", ".webmanifest")
    root = Path(__file__).resolve().parent
    handler = lambda *values, **kwargs: AppHandler(*values, directory=str(root), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"App Converter: http://127.0.0.1:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
