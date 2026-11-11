#!/usr/bin/env sh
# Starts the AIO bot on Linux/macOS.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Please install Node.js 20 or newer."; exit 1; }
[ -f .env ] || { cp .env.example .env; echo "Enter your Discord bot token in .env and start again."; exit 1; }
[ -d node_modules ] || npm install --omit=dev --no-audit --no-fund
while true; do
  node src/index.js
  echo "Bot stopped, restarting in 5 seconds (Ctrl+C to quit)."
  sleep 5
done
