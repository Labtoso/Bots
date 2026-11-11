#!/usr/bin/env bash
# Pulls new versions of the AIO bot from GitHub and restarts it.
# Runs every 15 minutes through aio-update.timer (set up by install/install.sh).
set -euo pipefail

DIR="${AIO_DIR:-/opt/aio}"
BRANCH="${AIO_BRANCH:-AIO}"
cd "$DIR"
git_() { git -c safe.directory="$DIR" "$@"; }
owner="$(stat -c %U "$DIR")"

old="$(git_ rev-parse HEAD)"
git_ fetch -q --depth 1 origin "$BRANCH"
new="$(git_ rev-parse FETCH_HEAD)"
[ "$old" = "$new" ] && exit 0

git_ reset -q --hard FETCH_HEAD
if ! git_ diff --quiet "$old" HEAD -- package.json package-lock.json 2>/dev/null; then
  echo "Updating dependencies"
  runuser -u "$owner" -- npm ci --omit=dev --no-audit --no-fund --loglevel=error
fi
chown -R "$owner:$owner" "$DIR"
chmod +x deploy/*.sh install/*.sh 2>/dev/null || true
systemctl restart aio
echo "Updated ${old:0:7} -> ${new:0:7}"
