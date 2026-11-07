#!/usr/bin/env bash
# Installs Msik on a Debian/Ubuntu VPS without Docker (systemd service).
# Usage (as root):
#   curl -fsSL https://raw.githubusercontent.com/Labtoso/Bots/Msik/deploy/install-vps.sh | bash -s -- --token <BOT_TOKEN> [--domain api.example.com] [--name VPS]
# With --domain, Caddy is installed and serves the API over HTTPS on that domain
# (DNS A record must point to this server, ports 80/443 open).
# Without --domain, a free Cloudflare quick tunnel is used.
set -euo pipefail

TOKEN=""; DOMAIN=""; NAME="VPS"; BRANCH="Msik"; DIR="/opt/msik"
while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done
[ "$(id -u)" -eq 0 ] || { echo "Please run as root."; exit 1; }

echo "== Installing packages"
apt-get update -y
apt-get install -y ca-certificates curl git ffmpeg
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "== Getting the bot"
id msik >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin msik
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone --branch "$BRANCH" --depth 1 https://github.com/Labtoso/Bots.git "$DIR"
fi
cd "$DIR"
npm ci --omit=dev --no-audit --no-fund

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
fi
[ -n "$TOKEN" ] && sed -i "s|^DISCORD_TOKEN=.*|DISCORD_TOKEN=$TOKEN|" .env
sed -i "s|^BACKEND_NAME=.*|BACKEND_NAME=$NAME|" .env

if [ -n "$DOMAIN" ]; then
  echo "== Installing Caddy for https://$DOMAIN"
  sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=https://$DOMAIN|; s|^TUNNEL=.*|TUNNEL=off|; s|^PORT=.*|PORT=8080|" .env
  if ! command -v caddy >/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gnupg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install -y caddy
  fi
  cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:8080 {
		flush_interval -1
	}
}
CADDY
  systemctl reload caddy || systemctl restart caddy
fi

chown -R msik:msik "$DIR"
cp deploy/msik.service /etc/systemd/system/msik.service
systemctl daemon-reload
systemctl enable --now msik
systemctl restart msik

echo
echo "Done. Logs: journalctl -u msik -f"
grep -q '^DISCORD_TOKEN=$' .env && echo "Bot token missing: edit $DIR/.env and run: systemctl restart msik"
exit 0
