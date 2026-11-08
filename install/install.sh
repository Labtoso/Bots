#!/usr/bin/env bash
# Msik installer for Linux (VPS or desktop). Installs or updates the bot as a systemd service.
#
#   curl -fsSL https://bot.labtoso.de/install.sh | sudo bash
#
# Options (all optional, the script asks for anything missing):
#   --token TOKEN     Discord bot token
#   --domain DOMAIN   API domain with HTTPS via Caddy (DNS A record must point to this server)
#   --name NAME       name of this backend in the dashboard (default: hostname)
#   --dir DIR         install directory (default: /opt/msik)
#   --no-service      install only, do not create/start the systemd service
#   --no-auto-update  do not install the update timer (default: checks GitHub every 15 minutes)
#   --yes             do not ask, use defaults (tunnel instead of domain)
set -euo pipefail

REPO="https://github.com/Labtoso/Bots.git"
BRANCH="Msik"
DIR="/opt/msik"
TOKEN=""; DOMAIN=""; SP_ID=""; SP_SECRET=""; NAME="$(hostname -s 2>/dev/null || echo VPS)"; SERVICE=1; ASK=1; AUTOUPDATE=1

while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --spotify-id) SP_ID="$2"; shift 2 ;;
    --spotify-secret) SP_SECRET="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --no-service) SERVICE=0; shift ;;
    --no-auto-update) AUTOUPDATE=0; shift ;;
    --yes|-y) ASK=0; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

c_ok="\033[32m"; c_dim="\033[2m"; c_off="\033[0m"
say() { printf "${c_ok}==>${c_off} %s\n" "$*"; }
ask() { # ask "Question" default -> answer (reads from the terminal even when piped)
  local q="$1" d="${2:-}" a=""
  if [ "$ASK" = 1 ] && [ -r /dev/tty ]; then
    printf "%s%s: " "$q" "${d:+ [$d]}" > /dev/tty
    read -r a < /dev/tty || true
  fi
  echo "${a:-$d}"
}

[ "$(id -u)" -eq 0 ] || { echo "Please run as root (sudo)."; exit 1; }
command -v apt-get >/dev/null || command -v dnf >/dev/null || { echo "Needs a Debian/Ubuntu (apt) or Fedora/RHEL (dnf) system."; exit 1; }

echo
echo "  Msik music bot installer"
echo

# ---------- token ----------
if [ -f "$DIR/.env" ] && grep -q '^DISCORD_TOKEN=.\+' "$DIR/.env"; then
  [ -z "$TOKEN" ] && say "Existing installation found, keeping its settings."
else
  if [ -z "$TOKEN" ]; then
    echo "You need a bot token:"
    echo "  1. Open https://discord.com/developers/applications and click New Application"
    echo "  2. Bot -> Reset Token -> copy it"
    echo
    TOKEN="$(ask "Paste the bot token")"
  fi
  [ -n "$TOKEN" ] || { echo "No token given."; exit 1; }
fi

if [ -z "$DOMAIN" ] && [ ! -f "$DIR/.env" ] && [ "$ASK" = 1 ]; then
  echo
  echo "API address: enter a domain (e.g. api.example.com, DNS A record to this server, ports 80/443 open)"
  echo "or leave it empty to use a free Cloudflare tunnel (address changes on every restart)."
  DOMAIN="$(ask "Domain (optional)")"
fi

if [ -z "$SP_SECRET" ] && [ ! -f "$DIR/.env" ] && [ "$ASK" = 1 ]; then
  echo
  echo "Spotify search (optional): the Client ID is built in, only the Client secret is needed."
  echo "Press Enter to skip, you can add SPOTIFY_CLIENT_SECRET to $DIR/.env later."
  SP_SECRET="$(ask "Spotify Client secret (optional)")"
fi

# ---------- packages ----------
need=""
for b in git curl ffmpeg; do command -v "$b" >/dev/null || need="$need $b"; done
if [ -n "$need" ]; then
  say "Installing:$need"
  if command -v apt-get >/dev/null; then
    apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates $need >/dev/null
  else
    dnf install -y -q $need
  fi
fi
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ "$(node_major)" -lt 20 ]; then
  say "Installing Node.js 22"
  if command -v apt-get >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null
    dnf install -y -q nodejs
  fi
fi

# ---------- code ----------
say "Getting Msik"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
  git -C "$DIR" reset -q --hard FETCH_HEAD
else
  mkdir -p "$DIR"
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$DIR.tmp"
  cp -a "$DIR.tmp/." "$DIR/"
  rm -rf "$DIR.tmp"
fi
cd "$DIR"
say "Installing dependencies"
npm ci --omit=dev --no-audit --no-fund --loglevel=error

# ---------- settings ----------
[ -f .env ] || cp .env.example .env
setenv() { # setenv KEY VALUE
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
[ -n "$TOKEN" ] && setenv DISCORD_TOKEN "$TOKEN"
[ -n "$SP_ID" ] && setenv SPOTIFY_CLIENT_ID "$SP_ID"
[ -n "$SP_SECRET" ] && setenv SPOTIFY_CLIENT_SECRET "$SP_SECRET"
grep -q '^BACKEND_NAME=.\+' .env || setenv BACKEND_NAME "$NAME"
if ! grep -q '^SESSION_SECRET=.\+' .env; then
  setenv SESSION_SECRET "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

if [ -n "$DOMAIN" ]; then
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
  setenv PUBLIC_URL "https://$DOMAIN"
  setenv TUNNEL off
  setenv PORT 8080
  if ! command -v caddy >/dev/null; then
    say "Installing Caddy (HTTPS)"
    if command -v apt-get >/dev/null; then
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
      curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
      apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy >/dev/null
    else
      dnf install -y -q 'dnf-command(copr)' && dnf copr enable -y @caddy/caddy && dnf install -y -q caddy
    fi
  fi
  cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:8080 {
		flush_interval -1
	}
}
CADDY
  systemctl enable -q caddy 2>/dev/null || true
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
fi

id msik >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin msik
chown -R msik:msik "$DIR"
chmod 600 .env

# ---------- service ----------
if [ "$SERVICE" = 1 ] && command -v systemctl >/dev/null && [ -d /run/systemd/system ]; then
  sed "s|/opt/msik|$DIR|g" deploy/msik.service > /etc/systemd/system/msik.service
  if [ "$AUTOUPDATE" = 1 ]; then
    sed "s|/opt/msik|$DIR|g" deploy/msik-update.service > /etc/systemd/system/msik-update.service
    cp deploy/msik-update.timer /etc/systemd/system/msik-update.timer
  fi
  systemctl daemon-reload
  systemctl enable -q msik
  if [ "$AUTOUPDATE" = 1 ]; then
    systemctl enable -q --now msik-update.timer
    say "Automatic updates on (every 15 minutes, waits while music plays)"
  else
    systemctl disable -q --now msik-update.timer 2>/dev/null || true
  fi
  systemctl restart msik
  say "Started. Waiting for the bot ..."
  for _ in $(seq 1 30); do
    sleep 2
    journalctl -u msik --since "-2min" --no-pager -o cat 2>/dev/null | grep -q "/web registriert" && break
  done
  echo
  journalctl -u msik --since "-2min" --no-pager -o cat 2>/dev/null | grep -E "Eingeloggt|Einladen|Öffentliche|FEHLER" | tail -5 || true
else
  say "Service skipped. Start manually: cd $DIR && sudo -u msik node src/index.js"
fi

echo
printf "${c_ok}Done.${c_off}\n"
echo "  Invite the bot with the \"Einladen\" link above (also in: journalctl -u msik | grep Einladen),"
echo "  then join a voice channel and type /web."
[ -n "$DOMAIN" ] && echo "  Dashboard backend: https://$DOMAIN"
echo "  Logs:      journalctl -u msik -f"
if [ "$AUTOUPDATE" = 1 ]; then
  echo "  Updates:   automatic (journalctl -u msik-update to see them)"
else
  echo "  Update:    run this installer again"
fi
echo "  Uninstall: curl -fsSL https://bot.labtoso.de/uninstall.sh | sudo bash"
printf "${c_dim}  Settings: $DIR/.env${c_off}\n"
