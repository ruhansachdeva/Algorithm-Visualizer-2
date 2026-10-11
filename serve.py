#!/usr/bin/env python3
"""
Tiny development server for the visualizer.

Python's built-in `http.server` sends no caching headers at all, which
sounds harmless but isn't: with nothing to go on, browsers fall back to a
heuristic and may keep serving an old copy of a file for a while. The
symptom is editing a file, reloading, and seeing no change.

This sends `Cache-Control: no-store` on everything, so a plain reload
always fetches the current file.
"""

import http.server
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # keep the terminal quiet


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), NoCacheHandler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
