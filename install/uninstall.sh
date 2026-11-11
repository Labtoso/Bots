#!/usr/bin/env bash
# Removes the AIO bot service and its files. Caddy stays installed.
#   curl -fsSL https://bot.labtoso.de/AIO/uninstall.sh | sudo bash
set -euo pipefail
DIR="${1:-/opt/aio}"
[ "$(id -u)" -eq 0 ] || { echo "Please run as root (sudo)."; exit 1; }
if [ -f /etc/systemd/system/aio-update.timer ]; then
  systemctl disable --now aio-update.timer 2>/dev/null || true
  rm -f /etc/systemd/system/aio-update.timer /etc/systemd/system/aio-update.service
fi
if [ -f /etc/systemd/system/aio.service ]; then
  systemctl disable --now aio 2>/dev/null || true
  rm -f /etc/systemd/system/aio.service
  systemctl daemon-reload
fi
if [ -f /etc/caddy/sites/aio.caddy ]; then rm -f /etc/caddy/sites/aio.caddy; systemctl reload caddy 2>/dev/null || true; fi
rm -rf "$DIR"
id aio >/dev/null 2>&1 && userdel aio 2>/dev/null || true
echo "AIO removed."
