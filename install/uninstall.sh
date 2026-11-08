#!/usr/bin/env bash
# Removes the Msik bot service and its files. Caddy stays installed.
#   curl -fsSL https://bot.labtoso.de/uninstall.sh | sudo bash
set -euo pipefail
DIR="${1:-/opt/msik}"
[ "$(id -u)" -eq 0 ] || { echo "Please run as root (sudo)."; exit 1; }
if [ -f /etc/systemd/system/msik.service ]; then
  systemctl disable --now msik 2>/dev/null || true
  rm -f /etc/systemd/system/msik.service
  systemctl daemon-reload
fi
rm -rf "$DIR"
id msik >/dev/null 2>&1 && userdel msik 2>/dev/null || true
echo "Msik removed."
