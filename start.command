#!/bin/bash
# ============================================================
#  Algorithm Visualizer — double-click this file to run it.
#
#  If a server is already running for this project, this just
#  opens the browser at it rather than starting a second one.
# ============================================================

cd "$(dirname "$0")" || exit 1

open_and_report() {
  echo ""
  echo "  ▶  Algorithm Visualizer is at http://localhost:$1"
  echo ""
  open "http://localhost:$1"
}

# ── already running? just open it ────────────────────────────
for p in $(seq 8000 8010); do
  if curl -s --max-time 1 "http://localhost:$p/index.html" 2>/dev/null | grep -q 'Algorithm Visualizer'; then
    echo ""
    echo "  Already running — opening it."
    open_and_report "$p"
    echo "  (This window can be closed; the server was started elsewhere.)"
    echo ""
    read -r -p "  Press return to close this window."
    exit 0
  fi
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "  python3 isn't installed, so this script can't start a server."
  echo "  Install it from python.org, or use the VS Code Live Server extension."
  read -r -p "  Press return to close."
  exit 1
fi

# ── find a free port ─────────────────────────────────────────
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ $PORT -gt 8010 ]; then
    echo "  Couldn't find a free port between 8000 and 8010."
    read -r -p "  Press return to close."
    exit 1
  fi
done

# serve.py rather than `python3 -m http.server`: the built-in one sends no
# caching headers, so browsers guess — and guess wrong, showing you an old
# copy of a file you just edited.
python3 serve.py "$PORT" >/dev/null 2>&1 &
SERVER=$!

trap 'kill $SERVER 2>/dev/null; exit 0' INT TERM EXIT

sleep 1
open_and_report "$PORT"
echo "  KEEP THIS WINDOW OPEN while you use the app."
echo "  Closing it, or pressing Control-C, stops the server."
echo ""

wait $SERVER
