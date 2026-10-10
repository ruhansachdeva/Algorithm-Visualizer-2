#!/bin/bash
# ============================================================
#  Algorithm Visualizer — double-click this file to run it.
#
#  Why a server is needed at all: the project is split across
#  several JavaScript modules, and browsers refuse to load
#  modules from a plain file:// path. Serving the folder over
#  http://localhost sidesteps that. Nothing leaves your machine.
# ============================================================

cd "$(dirname "$0")" || exit 1

# Find a free port, starting at 8000.
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ $PORT -gt 8050 ]; then
    echo "Couldn't find a free port between 8000 and 8050."
    read -r -p "Press return to close."
    exit 1
  fi
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 isn't installed, so this script can't start a server."
  echo "Install it from python.org, or use the VS Code Live Server extension instead."
  read -r -p "Press return to close."
  exit 1
fi

echo ""
echo "  Algorithm Visualizer is running at http://localhost:$PORT"
echo ""
echo "  Leave this window open while you use it."
echo "  Press Control-C here, or just close this window, to stop."
echo ""

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!

# Stop the server when this window closes or Control-C is pressed.
trap 'kill $SERVER 2>/dev/null; exit 0' INT TERM EXIT

sleep 1
open "http://localhost:$PORT"

wait $SERVER
