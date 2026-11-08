#!/usr/bin/env bash
# Pulls new versions of Msik from GitHub and restarts the bot.
# Runs every 15 minutes through msik-update.timer (set up by install/install.sh).
# Waits while music is playing, but never longer than 6 hours.
set -euo pipefail

DIR="${MSIK_DIR:-/opt/msik}"
BRANCH="${MSIK_BRANCH:-Msik}"
MAX_WAIT="${MSIK_MAX_WAIT:-21600}"
STATE_DIR="${MSIK_STATE_DIR:-/var/lib/msik}"
cd "$DIR"
git_() { git -c safe.directory="$DIR" "$@"; }
owner="$(stat -c %U "$DIR")"

# yt-dlp changes often (YouTube), keep it current without a restart
if [ -x bin/yt-dlp ]; then
  runuser -u "$owner" -- bin/yt-dlp -U >/dev/null 2>&1 || true
fi

old="$(git_ rev-parse HEAD)"
git_ fetch -q --depth 1 origin "$BRANCH"
new="$(git_ rev-parse FETCH_HEAD)"
mkdir -p "$STATE_DIR"
pending="$STATE_DIR/update-pending"
if [ "$old" = "$new" ]; then
  rm -f "$pending"
  exit 0
fi

# do not cut off a song: wait while something is playing
port="$(sed -n 's/^PORT=//p' .env 2>/dev/null | tail -1)"
active="$(curl -fsS --max-time 5 "http://127.0.0.1:${port:-8080}/health" 2>/dev/null | sed -n 's/.*"active":\([0-9]*\).*/\1/p')"
if [ "${active:-0}" -gt 0 ]; then
  [ -f "$pending" ] || date +%s > "$pending"
  waited=$(( $(date +%s) - $(cat "$pending") ))
  if [ "$waited" -lt "$MAX_WAIT" ]; then
    echo "Update ${new:0:7} ready, waiting: music is playing"
    exit 0
  fi
fi
rm -f "$pending"

git_ reset -q --hard FETCH_HEAD
if ! git_ diff --quiet "$old" HEAD -- package.json package-lock.json 2>/dev/null; then
  echo "Updating dependencies"
  runuser -u "$owner" -- npm ci --omit=dev --no-audit --no-fund --loglevel=error
fi
chown -R "$owner:$owner" "$DIR"
chmod +x deploy/*.sh install/*.sh 2>/dev/null || true
systemctl restart msik
echo "Updated ${old:0:7} -> ${new:0:7}"
