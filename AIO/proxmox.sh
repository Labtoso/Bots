#!/usr/bin/env bash
# AIO bot for Proxmox VE: creates a Debian LXC container and installs the bot inside.
# Run in the Proxmox host shell (Datacenter -> your node -> Shell) as root:
#
#   bash -c "$(curl -fsSL https://bot.labtoso.de/AIO/proxmox.sh)"
#
# If the Msik music bot already runs in a container, AIO is installed into that container (no new one)
# and the container is renamed to "Bots". Run it again to update (keeps everything).
# AIO_NEW=1 bash -c "$(curl ...)" always creates a new container.
set -Eeuo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8 LANGUAGE=

INSTALLER="https://bot.labtoso.de/AIO/install.sh"
NOTES_URL="https://bot.labtoso.de/bot-notes.sh"
TITLE="AIO Discord bot"

c_ok="\033[32m"; c_err="\033[31m"; c_dim="\033[2m"; c_b="\033[1m"; c_off="\033[0m"
say()  { printf " ${c_ok}✓${c_off} %s\n" "$*"; }
info() { printf " ${c_dim}…${c_off} %s\n" "$*"; }
die()  { printf "\n ${c_err}✗ %s${c_off}\n\n" "$*" >&2; exit 1; }
trap 'die "Failed in line $LINENO: $BASH_COMMAND"' ERR

[ "$(id -u)" -eq 0 ] || die "Please run this as root in the Proxmox host shell."
command -v pveversion >/dev/null && command -v pct >/dev/null || die "This is not a Proxmox VE host. Run it in the shell of your Proxmox node."
command -v whiptail >/dev/null || { apt-get update -qq && apt-get install -y -qq whiptail >/dev/null; }
if [ ! -t 0 ] && (exec </dev/tty) 2>/dev/null; then exec </dev/tty; fi

clear 2>/dev/null || true
printf "\n  ${c_b}%s${c_off} · Proxmox LXC installer\n  ${c_dim}%s${c_off}\n\n" "$TITLE" "$(pveversion | cut -d/ -f1-2)"

cancel() { clear 2>/dev/null || true; echo "Cancelled, nothing was changed."; exit 0; }
input()  { whiptail --backtitle "$TITLE" --title "$1" --inputbox "$2" 11 70 "${3:-}" 3>&1 1>&2 2>&3 || cancel; }
secret() { whiptail --backtitle "$TITLE" --title "$1" --passwordbox "$2" 13 72 3>&1 1>&2 2>&3 || cancel; }
yesno()  { whiptail --backtitle "$TITLE" --title "$1" --yesno "$2" 11 70; }
num()    { [[ "$1" =~ ^[0-9]+$ ]] || die "$2 must be a number (got \"$1\")."; }

# ---------- Notes in the Proxmox UI ----------
# A helper on the host writes the current backend address into the container's Notes
# (container -> Summary). A timer refreshes it every 2 minutes, the free tunnel changes its address on restarts.
# The helper is shared with the Msik music bot, so a container that runs both shows both addresses.
install_notes() {
  local tmp; tmp=$(mktemp)
  curl -fsSL "$NOTES_URL" -o "$tmp" || { rm -f "$tmp"; die "Could not download the notes helper ($NOTES_URL)."; }
  install -m 755 "$tmp" /usr/local/bin/bot-notes; rm -f "$tmp"
  for b in msik aio; do printf '#!/bin/sh\nexec /usr/local/bin/bot-notes %s "$@"\n' "$b" > "/usr/local/bin/$b-notes"; chmod 755 "/usr/local/bin/$b-notes"; done
  systemctl disable -q --now msik-notes.timer aio-notes.timer 2>/dev/null || true
  rm -f /etc/systemd/system/msik-notes.service /etc/systemd/system/msik-notes.timer /etc/systemd/system/aio-notes.service /etc/systemd/system/aio-notes.timer
  cat > /etc/systemd/system/bot-notes.service <<'UNIT'
[Unit]
Description=Write the bot backend addresses into the container notes

[Service]
Type=oneshot
ExecStart=/usr/local/bin/bot-notes
StandardOutput=null
UNIT
  cat > /etc/systemd/system/bot-notes.timer <<'UNIT'
[Unit]
Description=Refresh the bot container notes every 2 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable -q --now bot-notes.timer
}

show_backend() { # waits for the address, writes the Notes and prints all links of the container in this shell
  local id="$1" url="" i
  info "Waiting for the backend address"
  for i in $(seq 1 40); do
    url=$(/usr/local/bin/bot-notes aio "$id" | awk '{print $2}')
    [ -n "$url" ] && break
    sleep 3
  done
  rm -f "/run/bot-notes/$id"; /usr/local/bin/bot-notes "$id" >/dev/null
  /usr/local/bin/bot-notes --print "$id"
}

# exactly 2 cores (or fewer when the host has fewer); RAM stays as it is
cores_for() { local n; n=$(nproc 2>/dev/null || echo 2); echo $(( n < 2 ? n : 2 )); }

# ---------- find containers that already run a bot ----------
has_tag() { pct config "$1" 2>/dev/null | sed -n 's/^tags: *//p' | tr ';,' '  ' | grep -qw "$2"; }
add_tag() { # add_tag CTID TAG (keeps the other tags)
  local t; t=$(pct config "$1" | sed -n 's/^tags: *//p')
  has_tag "$1" "$2" || pct set "$1" --tags "${t:+$t;}$2"
}
# A container with both bots is called "Bots" (hostname = name in the Proxmox tree)
name_bots() {
  [ "$(pct config "$1" | awk '/^hostname:/ {print $2}')" = Bots ] && return 0
  pct set "$1" --hostname Bots
  pct exec "$1" -- sh -c 'hostname Bots 2>/dev/null; echo Bots > /etc/hostname; sed -i "s/^\(127\.0\.1\.1[[:space:]]\+\).*/\1Bots/" /etc/hosts' 2>/dev/null || true
  say "Container $1 is now called \"Bots\""
}
ensure_running() { [ "$(pct status "$1" | awk '{print $2}')" = running ] || { info "Starting container $1"; pct start "$1"; sleep 5; }; }

aio_cts=(); msik_cts=()
while read -r id _ name; do
  [ -n "${id:-}" ] || continue
  if has_tag "$id" aio; then aio_cts+=("$id" "$name")
  elif has_tag "$id" msik; then msik_cts+=("$id" "$name"); fi
done < <(pct list 2>/dev/null | awk 'NR>1 {print $1, $2, $NF}')

# AIO_NEW=1 always creates a new container
if [ "${AIO_NEW:-0}" != 1 ] && [ "${#aio_cts[@]}" -gt 0 ]; then
  # rerun = update, no questions
  if [ "${#aio_cts[@]}" -eq 2 ]; then CT="${aio_cts[0]}"; else
    CT=$(whiptail --backtitle "$TITLE" --title "Update" --menu "AIO runs in several containers. Which one should be updated?" 15 64 6 "${aio_cts[@]}" 3>&1 1>&2 2>&3) || cancel
  fi
  clear 2>/dev/null || true
  printf "\n  ${c_b}%s${c_off}\n\n" "$TITLE"
  ensure_running "$CT"
  if has_tag "$CT" msik; then
    name_bots "$CT" # shared with the music bot: leave its cores and RAM alone
  else
    want=$(cores_for); cur=$(pct config "$CT" | awk '/^cores:/ {print $2}')
    if [ "${cur:-0}" != "$want" ]; then pct set "$CT" --cores "$want"; say "Container $CT now uses $want CPU cores"; fi
  fi
  info "Updating AIO in container $CT (keeps token, domain and settings)"
  pct exec "$CT" -- bash -c "curl -fsSL $INSTALLER | bash -s -- --yes"
  say "Container $CT is up to date."
  install_notes
  show_backend "$CT"
  echo
  exit 0
fi

ask_token() { # sets TOKEN and BOTNAME
  TOKEN=""; BOTNAME=""
  while [ -z "$BOTNAME" ]; do
    TOKEN=$(secret "Discord bot token" "Paste your bot token (right click or Ctrl+Shift+V).\n\ndiscord.com/developers/applications: New Application -> Bot -> Reset Token.\nTurn on Server Members Intent + Message Content Intent there too.\nUse a new application, not the one of the music bot.")
    TOKEN="${TOKEN//[[:space:]]/}"
    [ -n "$TOKEN" ] || continue
    BOTNAME=$(curl -fsS --max-time 10 -H "Authorization: Bot $TOKEN" https://discord.com/api/v10/users/@me 2>/dev/null | sed -n 's/.*"username": *"\([^"]*\)".*/\1/p' || true)
    if [ -z "$BOTNAME" ]; then
      curl -fsS --max-time 5 -o /dev/null https://discord.com 2>/dev/null || { BOTNAME="?"; break; } # host has no internet check, try anyway
      whiptail --backtitle "$TITLE" --title "Token" --msgbox "This token does not work. Copy it again with \"Reset Token\"." 9 60
    fi
  done
}

install_aio() { # install_aio CTID NAME ARGS... -> runs the Linux installer inside the container
  local ct="$1" name="$2" tmp; shift 2
  # The token goes in via a root-only file, so it never shows up in the host's process list.
  tmp=$(mktemp); chmod 600 "$tmp"
  printf 'TOKEN=%q\nDOMAIN=%q\n' "$TOKEN" "${DOMAIN:-}" > "$tmp"
  pct push "$ct" "$tmp" /root/.aio-setup --perms 600
  rm -f "$tmp"; unset TOKEN
  info "Installing AIO (Node.js and the bot) - takes a few minutes"
  pct exec "$ct" -- bash -c '
    set -e
    . /root/.aio-setup; rm -f /root/.aio-setup
    set -- --yes --name "'"$name"'" '"$*"' --token "$TOKEN"
    [ -n "$DOMAIN" ] && set -- "$@" --domain "$DOMAIN"
    curl -fsSL '"$INSTALLER"' | bash -s -- "$@"
  '
}

finish() { # finish CTID
  local ct="$1"
  install_notes
  echo
  printf " ${c_ok}${c_b}AIO läuft in Container %s${c_off}\n" "$ct"
  show_backend "$ct"
  echo
  echo "  Shell:   pct enter $ct"
  echo "  Update:  run this script again (or it updates itself every 15 minutes)"
}

# ---------- the music bot is already here: install AIO next to it ----------
if [ "${AIO_NEW:-0}" != 1 ] && [ "${#msik_cts[@]}" -gt 0 ]; then
  if [ "${#msik_cts[@]}" -eq 2 ]; then CT="${msik_cts[0]}"; else
    CT=$(whiptail --backtitle "$TITLE" --title "Msik found" --menu "The Msik music bot runs in several containers. Install AIO into which one?" 15 64 6 "${msik_cts[@]}" 3>&1 1>&2 2>&3) || cancel
  fi
  ask_token
  clear 2>/dev/null || true
  printf "\n  ${c_b}%s${c_off}\n\n" "$TITLE"
  say "Msik found in container $CT, installing AIO there (no new container)"
  [ "$BOTNAME" != "?" ] && say "Token OK: $BOTNAME"
  ensure_running "$CT"
  install_aio "$CT" Bots
  add_tag "$CT" aio
  name_bots "$CT"
  finish "$CT"
  echo "  Msik keeps running in the same container (port 8080, AIO uses 8090)."
  echo "  Remove AIO only: pct exec $CT -- bash -c \"curl -fsSL https://bot.labtoso.de/AIO/uninstall.sh | bash\""
  echo
  exit 0
fi

# ---------- defaults ----------
CTID=$(pvesh get /cluster/nextid)
HN="aio"; CORES=$(cores_for); RAM=512; DISK=4; BRIDGE="vmbr0"; NET="dhcp"; GATE=""; VLAN=""; PW=""
UNPRIV=1; AUTOUPDATE=1; DOMAIN=""; DNS=""

pick_storage() {
  local content="$1" label="$2" list=() n
  while read -r name type _ _ _ avail _; do
    [ -n "${name:-}" ] || continue
    list+=("$name" "$(printf '%-10s %s GB free' "$type" "$((avail / 1024 / 1024))")" "OFF")
  done < <(pvesm status -content "$content" 2>/dev/null | awk 'NR>1 && $3=="active"')
  n=$(( ${#list[@]} / 3 ))
  [ "$n" -gt 0 ] || die "No active storage for $label ($content) found."
  if [ "$n" -eq 1 ]; then echo "${list[0]}"; return; fi
  list[2]="ON"
  whiptail --backtitle "$TITLE" --title "Storage" --radiolist \
    "Where should the $label go? (Space to select)" 16 70 6 "${list[@]}" 3>&1 1>&2 2>&3 || cancel
}

MODE=$(whiptail --backtitle "$TITLE" --title "AIO on Proxmox" --menu \
  "Creates a Debian 12 LXC container and installs the AIO bot in it.\n\nDefaults: ID $CTID, $CORES CPU, 512 MB RAM, 4 GB disk, $BRIDGE with DHCP." 16 70 2 \
  "simple" "Use the defaults (recommended)" \
  "advanced" "Choose ID, resources, network and more" 3>&1 1>&2 2>&3) || cancel

if [ "$MODE" = advanced ]; then
  CTID=$(input "Container ID" "Container ID:" "$CTID"); num "$CTID" "Container ID"
  if pct status "$CTID" >/dev/null 2>&1 || qm status "$CTID" >/dev/null 2>&1; then die "ID $CTID is already in use."; fi
  HN=$(input "Hostname" "Hostname:" "$HN")
  CORES=$(input "CPU" "CPU cores:" "$CORES"); num "$CORES" "CPU cores"
  RAM=$(input "RAM" "RAM in MB (512 is plenty):" "$RAM"); num "$RAM" "RAM"
  DISK=$(input "Disk" "Disk size in GB:" "$DISK"); num "$DISK" "Disk size"
  BRIDGE=$(input "Network" "Bridge:" "$BRIDGE")
  NET=$(input "Network" "IPv4: dhcp, or a static address with prefix (e.g. 192.168.1.51/24):" "$NET")
  if [ "$NET" != dhcp ]; then
    [[ "$NET" =~ ^[0-9.]+/[0-9]+$ ]] || die "Static IP needs a prefix, e.g. 192.168.1.51/24."
    GATE=$(input "Network" "Gateway (e.g. 192.168.1.1):" "")
    DNS=$(input "Network" "DNS server (empty = same as the Proxmox host):" "")
  fi
  VLAN=$(input "Network" "VLAN tag (empty = none):" "")
  [ -z "$VLAN" ] || num "$VLAN" "VLAN tag"
  yesno "Container type" "Unprivileged container? (recommended)" || UNPRIV=0
  PW=$(secret "Root password" "Root password for the console (empty = no password, use 'pct enter $CTID'):")
  DOMAIN=$(input "API address" "Own domain for HTTPS via Caddy, e.g. aio.example.com\n(DNS A record + ports 80/443 to this container).\nEmpty = free Cloudflare tunnel." "")
  yesno "Updates" "Update the bot automatically? (checks GitHub every 15 minutes)" || AUTOUPDATE=0
fi

ask_token

ROOTFS=$(pick_storage rootdir "container disk")
TMPL_STORE=$(pick_storage vztmpl "Debian template")

clear 2>/dev/null || true
printf "\n  ${c_b}%s${c_off}\n\n" "$TITLE"
[ "$BOTNAME" != "?" ] && say "Token OK: $BOTNAME"
say "Disk on $ROOTFS, template on $TMPL_STORE"

info "Looking for the Debian template"
pveam update >/dev/null 2>&1 || true
TMPL=$(pveam available --section system 2>/dev/null | awk '{print $2}' | grep -E '^debian-12-standard' | sort -V | tail -1 || true)
[ -n "$TMPL" ] || TMPL=$(pveam available --section system 2>/dev/null | awk '{print $2}' | grep -E '^debian-[0-9]+-standard' | sort -V | tail -1 || true)
[ -n "$TMPL" ] || die "No Debian template found (pveam available). Is the host online?"
if ! pveam list "$TMPL_STORE" 2>/dev/null | grep -q "$TMPL"; then
  info "Downloading $TMPL"
  pveam download "$TMPL_STORE" "$TMPL" >/dev/null
fi
say "Template $TMPL"

net="name=eth0,bridge=$BRIDGE,ip=$NET"
[ -n "$GATE" ] && net="$net,gw=$GATE"
[ -n "$VLAN" ] && net="$net,tag=$VLAN"
opts=(
  --hostname "$HN" --cores "$CORES" --memory "$RAM" --swap 512
  --rootfs "$ROOTFS:$DISK" --net0 "$net" --ostype debian
  --unprivileged "$UNPRIV" --features nesting=1 --onboot 1 --tags aio
  --description "AIO Discord bot, installing ..."
)
[ -n "$DNS" ] && opts+=(--nameserver "$DNS")
[ -n "$PW" ] && opts+=(--password "$PW")

info "Creating container $CTID"
pct create "$CTID" "$TMPL_STORE:vztmpl/$TMPL" "${opts[@]}" >/dev/null
say "Container $CTID ($HN) created"
pct start "$CTID"

info "Waiting for the network"
for i in $(seq 1 30); do
  pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
  [ "$i" -eq 30 ] && die "The container has no internet connection. Check bridge/IP settings (pct config $CTID)."
  sleep 2
done
say "Network ready"

info "Preparing Debian"
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq >/dev/null && apt-get -y -qq -o Dpkg::Use-Pty=0 upgrade >/dev/null 2>&1 && apt-get install -y -qq -o Dpkg::Use-Pty=0 curl ca-certificates >/dev/null 2>&1"
# same time zone as the host, for scheduled messages and birthdays
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl show -p Timezone --value 2>/dev/null || true)
[ -n "$HOST_TZ" ] && pct exec "$CTID" -- bash -c "ln -sf /usr/share/zoneinfo/$HOST_TZ /etc/localtime && echo $HOST_TZ > /etc/timezone" 2>/dev/null || true
say "Debian up to date"

args=""
[ "$AUTOUPDATE" = 1 ] || args="--no-auto-update"
install_aio "$CTID" "$HN" $args
finish "$CTID"
echo "  Remove:  pct stop $CTID && pct destroy $CTID"
echo "           (notes helper on the host: systemctl disable --now bot-notes.timer)"
echo
