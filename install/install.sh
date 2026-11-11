#!/usr/bin/env bash
# AIO bot installer for Linux (VPS or desktop). Installs or updates the bot as a systemd service.
#
#   curl -fsSL https://bot.labtoso.de/AIO/install.sh | sudo bash
#
# Options (all optional, the script asks for anything missing):
#   --token TOKEN     Discord bot token
#   --domain DOMAIN   API domain with HTTPS via Caddy (DNS A record must point to this server)
#   --name NAME       name of this backend in the panel (default: hostname)
#   --dir DIR         install directory (default: /opt/aio)
#   --no-service      install only, do not create/start the systemd service
#   --no-auto-update  do not install the update timer (default: checks GitHub every 15 minutes)
#   --yes             do not ask, use defaults (tunnel instead of domain)
# Run it again to update; everything set before (token, domain, name) is kept.
set -euo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8 LANGUAGE=

REPO="https://github.com/Labtoso/Bots.git"
BRANCH="AIO"
DIR="/opt/aio"
TOKEN=""; DOMAIN=""; NAME="$(hostname -s 2>/dev/null || echo VPS)"; SERVICE=1; ASK=1; AUTOUPDATE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --no-service) SERVICE=0; shift ;;
    --no-auto-update) AUTOUPDATE=0; shift ;;
    --auto-update) AUTOUPDATE=1; shift ;;
    --yes|-y) ASK=0; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

c_ok="\033[32m"; c_dim="\033[2m"; c_b="\033[1m"; c_warn="\033[33m"; c_off="\033[0m"
say() { printf "${c_ok}==>${c_off} %s\n" "$*"; }
ask() {
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
echo "  AIO bot installer"
echo

# ---------- packages ----------
need=""
for b in git curl; do command -v "$b" >/dev/null || need="$need $b"; done
if [ -n "$need" ]; then
  say "Installing:$need"
  if command -v apt-get >/dev/null; then
    apt-get update -qq >/dev/null 2>&1 || apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq -o Dpkg::Use-Pty=0 ca-certificates $need >/dev/null 2>&1 \
      || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates $need
  else
    dnf install -y -q $need
  fi
fi

# ---------- token ----------
check_token() { # prints the bot name, or nothing when the token is wrong
  curl -fsS --max-time 10 -H "Authorization: Bot $1" https://discord.com/api/v10/users/@me 2>/dev/null | sed -n 's/.*"username": *"\([^"]*\)".*/\1/p'
}
if [ -f "$DIR/.env" ] && grep -q '^DISCORD_TOKEN=.\+' "$DIR/.env" && [ -z "$TOKEN" ]; then
  say "Existing installation found, keeping its settings."
else
  if [ -z "$TOKEN" ]; then
    echo "You need a bot token:"
    echo "  1. Open https://discord.com/developers/applications and click New Application"
    echo "  2. Bot -> Reset Token -> copy it"
    echo "  3. On the same page turn on \"Server Members Intent\" and \"Message Content Intent\""
    echo
  fi
  while :; do
    [ -n "$TOKEN" ] || TOKEN="$(ask "Paste the bot token")"
    TOKEN="${TOKEN//[[:space:]]/}"
    [ -n "$TOKEN" ] || { echo "No token given."; exit 1; }
    BOTNAME="$(check_token "$TOKEN" || true)"
    if [ -n "$BOTNAME" ]; then say "Token OK: $BOTNAME"; break; fi
    if [ "$ASK" = 1 ] && [ -r /dev/tty ]; then echo "This token does not work. Copy it again with \"Reset Token\"."; TOKEN=""; else echo "Warning: could not check the token, continuing."; break; fi
  done
fi

if [ -z "$DOMAIN" ] && [ ! -f "$DIR/.env" ] && [ "$ASK" = 1 ]; then
  echo
  echo "API address: enter a domain (e.g. aio.example.com, DNS A record to this server, ports 80/443 open)"
  echo "or leave it empty to use a free Cloudflare tunnel (address changes on every restart)."
  DOMAIN="$(ask "Domain (optional)")"
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
say "Getting AIO"
if [ -d "$DIR/.git" ]; then
  git -c safe.directory="$DIR" -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
  git -c safe.directory="$DIR" -C "$DIR" reset -q --hard FETCH_HEAD
else
  mkdir -p "$DIR"
  rm -rf "$DIR.tmp"
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$DIR.tmp"
  cp -a "$DIR.tmp/." "$DIR/"
  rm -rf "$DIR.tmp"
fi
cd "$DIR"
say "Installing dependencies"
npm ci --omit=dev --no-audit --no-fund --loglevel=error

# ---------- settings ----------
[ -f .env ] || cp .env.example .env
setenv() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
[ -n "$TOKEN" ] && setenv DISCORD_TOKEN "$TOKEN"
grep -q '^BACKEND_NAME=.\+' .env || setenv BACKEND_NAME "$NAME"
if [ -z "$AUTOUPDATE" ]; then
  AUTOUPDATE="$(sed -n 's/^AUTO_UPDATE=//p' .env | tail -1)"
  [ -n "$AUTOUPDATE" ] || AUTOUPDATE=1
fi
setenv AUTO_UPDATE "$AUTOUPDATE"
grep -q '^SESSION_SECRET=.\+' .env || setenv SESSION_SECRET "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
grep -q '^TZ=.\+' .env || setenv TZ "$(cat /etc/timezone 2>/dev/null || timedatectl show -p Timezone --value 2>/dev/null || echo Europe/Vienna)"
PORT="$(sed -n 's/^PORT=//p' .env | tail -1)"; PORT="${PORT:-8090}"

if [ -n "$DOMAIN" ]; then
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
  setenv PUBLIC_URL "https://$DOMAIN"
  setenv TUNNEL off
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
  # one file per site, so the music bot and this bot can share one Caddy
  mkdir -p /etc/caddy/sites
  grep -q 'import sites/\*' /etc/caddy/Caddyfile 2>/dev/null || echo 'import sites/*' >> /etc/caddy/Caddyfile
  cat > /etc/caddy/sites/aio.caddy <<CADDY
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$PORT
}
CADDY
  systemctl enable -q caddy 2>/dev/null || true
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
fi

id aio >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin aio
chown -R aio:aio "$DIR"
chmod 600 .env

# ---------- service ----------
if [ "$SERVICE" = 1 ] && command -v systemctl >/dev/null && [ -d /run/systemd/system ]; then
  sed "s|/opt/aio|$DIR|g" deploy/aio.service > /etc/systemd/system/aio.service
  if [ "$AUTOUPDATE" = 1 ]; then
    sed "s|/opt/aio|$DIR|g" deploy/aio-update.service > /etc/systemd/system/aio-update.service
    cp deploy/aio-update.timer /etc/systemd/system/aio-update.timer
  fi
  systemctl daemon-reload
  systemctl enable -q aio
  if [ "$AUTOUPDATE" = 1 ]; then
    systemctl enable -q --now aio-update.timer
    say "Automatic updates on (every 15 minutes)"
  else
    systemctl disable -q --now aio-update.timer 2>/dev/null || true
  fi
  systemctl restart aio
  say "Started. Waiting for the bot ..."
  for _ in $(seq 1 40); do
    sleep 2
    journalctl -u aio --since "-2min" --no-pager -o cat 2>/dev/null | grep -qE "/aio registriert|FEHLER" && break
  done
  echo
  journalctl -u aio --since "-2min" --no-pager -o cat 2>/dev/null | grep -E "Eingeloggt|Einladen|Öffentliche|FEHLER|Intents" | tail -6 || true
  URL="$(sed -n 's/^PUBLIC_URL=//p' .env | tail -1)"
  [ -n "$URL" ] || URL="$(journalctl -u aio --since "-2min" --no-pager -o cat 2>/dev/null | grep -a "API-Adresse" | grep -o "https://[^ ]*" | tail -1)"
  if [ -n "$URL" ]; then
    echo
    printf "  ${c_b}Backend address:${c_off} ${c_ok}${c_b}%s${c_off}\n" "$URL"
  fi
else
  say "Service skipped. Start manually: cd $DIR && sudo -u aio node src/index.js"
fi

echo
printf "${c_ok}Done.${c_off}\n"
echo "  Invite the bot with the \"Einladen\" link above (also in: journalctl -u aio | grep Einladen),"
echo "  then type /aio on your server to open the panel."
printf "  ${c_warn}Remember:${c_off} Developer Portal -> Bot -> turn on \"Server Members Intent\" and \"Message Content Intent\".\n"
echo "  Logs:      journalctl -u aio -f"
if [ "$AUTOUPDATE" = 1 ]; then echo "  Updates:   automatic (journalctl -u aio-update)"; else echo "  Update:    run this installer again"; fi
echo "  Uninstall: curl -fsSL https://bot.labtoso.de/AIO/uninstall.sh | sudo bash"
printf "${c_dim}  Settings: $DIR/.env${c_off}\n"
