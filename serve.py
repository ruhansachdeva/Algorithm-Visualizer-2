#!/usr/bin/env python3
"""
Development server for the visualizer.

Two jobs beyond serving files:

1. Send `Cache-Control: no-store`. Python's built-in http.server sends no
   caching headers at all, so browsers fall back to a heuristic and may keep
   serving an old copy of a file you just edited.

2. Stamp a version onto every asset URL. Header (1) only governs what the
   browser does with NEW responses — anything already sitting in the cache
   from before stays there. Appending `?v=<version>` makes each URL look new,
   so the browser has no cached entry to reuse.

   This has to reach inside the JavaScript too. The page loads one module,
   and that module imports others by relative path; stamping only the
   <script> tag would leave every imported file free to come from cache.
   So .js responses get their import specifiers rewritten as well.
"""

import http.server
import os
import re
import socketserver
import sys
import time

# One version per server start: everything is refetched on restart, and
# nothing is refetched needlessly while it runs.
VERSION = str(int(time.time()))

# href="css/style.css"  /  src="js/main.js"
HTML_ASSET = re.compile(r'((?:href|src)=")([^"]+\.(?:css|js))(")')

# from './registry.js'   /   from "../views/draw.js"   /   import('./x.js')
JS_IMPORT = re.compile(r"""((?:from|import)\s*\(?\s*['"])(\.{1,2}/[^'"]+\.js)(['"])""")


def stamp(url: str) -> str:
    return url if "?" in url else f"{url}?v={VERSION}"


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")

        if path.endswith((".html", ".js")) and os.path.isfile(path):
            return self._send_rewritten(path)
        return super().send_head()

    def _send_rewritten(self, path):
        """Serve a file with every asset URL inside it version-stamped."""
        try:
            with open(path, "rb") as fh:
                text = fh.read().decode("utf-8")
        except (OSError, UnicodeDecodeError):
            return super().send_head()

        if path.endswith(".html"):
            text = HTML_ASSET.sub(lambda m: m.group(1) + stamp(m.group(2)) + m.group(3), text)
            ctype = "text/html; charset=utf-8"
        else:
            text = JS_IMPORT.sub(lambda m: m.group(1) + stamp(m.group(2)) + m.group(3), text)
            ctype = "text/javascript; charset=utf-8"

        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()

        import io
        return io.BytesIO(body)

    def log_message(self, *args):
        pass  # keep the terminal quiet


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), DevHandler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
