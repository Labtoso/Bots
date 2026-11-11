#!/usr/bin/env bash
# Msik music bot for Proxmox VE: creates a Debian LXC container and installs the bot inside.
# Run in the Proxmox host shell (Datacenter -> your node -> Shell) as root:
#
#   bash -c "$(curl -fsSL https://bot.labtoso.de/proxmox.sh)"
#
# Run it again to update an existing Msik container or to create another one.
set -Eeuo pipefail
# "pct exec" hands the host's locale to the container, where it usually does not exist (noisy apt/perl)
export LANG=C.UTF-8 LC_ALL=C.UTF-8 LANGUAGE=

INSTALLER="https://bot.labtoso.de/install.sh"
TITLE="Msik music bot"

c_ok="\033[32m"; c_err="\033[31m"; c_dim="\033[2m"; c_b="\033[1m"; c_off="\033[0m"
say()  { printf " ${c_ok}✓${c_off} %s\n" "$*"; }
info() { printf " ${c_dim}…${c_off} %s\n" "$*"; }
die()  { printf "\n ${c_err}✗ %s${c_off}\n\n" "$*" >&2; exit 1; }
trap 'die "Failed in line $LINENO: $BASH_COMMAND"' ERR

# ---------- checks ----------
[ "$(id -u)" -eq 0 ] || die "Please run this as root in the Proxmox host shell."
command -v pveversion >/dev/null && command -v pct >/dev/null || die "This is not a Proxmox VE host. Run it in the shell of your Proxmox node."
command -v whiptail >/dev/null || { apt-get update -qq && apt-get install -y -qq whiptail >/dev/null; }
if [ ! -t 0 ] && (exec </dev/tty) 2>/dev/null; then exec </dev/tty; fi

clear 2>/dev/null || true
printf "\n  ${c_b}%s${c_off} · Proxmox LXC installer\n  ${c_dim}%s${c_off}\n\n" "$TITLE" "$(pveversion | cut -d/ -f1-2)"

cancel() { clear 2>/dev/null || true; echo "Cancelled, nothing was changed."; exit 0; }
input()  { whiptail --backtitle "$TITLE" --title "$1" --inputbox "$2" 11 70 "${3:-}" 3>&1 1>&2 2>&3 || cancel; }
secret() { whiptail --backtitle "$TITLE" --title "$1" --passwordbox "$2" 12 70 3>&1 1>&2 2>&3 || cancel; }
yesno()  { whiptail --backtitle "$TITLE" --title "$1" --yesno "$2" 11 70; }
spotify() { # asks for the Spotify Client ID, then the Client secret; Enter, Esc or Skip skips each
  SP_ID=$(whiptail --backtitle "$TITLE" --title "Spotify (optional) 1/2" --cancel-button "Skip" --inputbox \
    "Spotify Client ID for the Spotify search.\n\nGet it at developer.spotify.com/dashboard -> your app -> Settings.\nLeave it empty and press Enter to use the built-in one." 13 74 3>&1 1>&2 2>&3) || SP_ID=""
  SP_ID="${SP_ID//[[:space:]]/}"
  SP_SECRET=$(whiptail --backtitle "$TITLE" --title "Spotify (optional) 2/2" --cancel-button "Skip" --passwordbox \
    "Spotify Client secret (same page, \"View client secret\").\n\nLeave it empty and press Enter to skip, you can add it later." 12 74 3>&1 1>&2 2>&3) || SP_SECRET=""
  SP_SECRET="${SP_SECRET//[[:space:]]/}"
}
num()    { [[ "$1" =~ ^[0-9]+$ ]] || die "$2 must be a number (got \"$1\")."; }

# ---------- Notes in the Proxmox UI ----------
# A helper on the host writes the current backend address into the container's Notes
# (Proxmox UI: container -> Summary). A timer refreshes it every 2 minutes, because the free
# Cloudflare tunnel gets a new address on every restart. The helper is shared with the AIO bot,
# so a container that runs both shows both addresses.
install_notes() {
  local tmp; tmp=$(mktemp)
  curl -fsSL https://bot.labtoso.de/bot-notes.sh -o "$tmp" || { rm -f "$tmp"; die "Could not download the notes helper."; }
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
    url=$(/usr/local/bin/bot-notes msik "$id" | awk '{print $2}')
    [ -n "$url" ] && break
    sleep 3
  done
  rm -f "/run/bot-notes/$id"; /usr/local/bin/bot-notes "$id" >/dev/null
  /usr/local/bin/bot-notes --print "$id"
}

# ---------- update an existing container ----------
existing=()
while read -r id _ name; do
  [ -n "${id:-}" ] || continue
  if pct config "$id" 2>/dev/null | grep -q '^tags:.*msik'; then existing+=("$id" "$name"); fi
done < <(pct list 2>/dev/null | awk 'NR>1 {print $1, $2, $NF}')

if [ "${#existing[@]}" -gt 0 ]; then
  choice=$(whiptail --backtitle "$TITLE" --title "Msik found" --menu \
    "There is already a Msik container on this node. What do you want to do?" 15 70 6 \
    "update" "Update the bot in an existing container" \
    "new" "Create another Msik container" 3>&1 1>&2 2>&3) || cancel
  if [ "$choice" = update ]; then
    if [ "${#existing[@]}" -eq 2 ]; then CT="${existing[0]}"; else
      CT=$(whiptail --backtitle "$TITLE" --title "Update" --menu "Which container?" 15 60 6 "${existing[@]}" 3>&1 1>&2 2>&3) || cancel
    fi
    clear 2>/dev/null || true
    [ "$(pct status "$CT" | awk '{print $2}')" = running ] || { info "Starting container $CT"; pct start "$CT"; sleep 5; }
    # the bot gets exactly 2 cores, enough for it and the rest of the server stays free (RAM stays as it is)
    cur_cores=$(pct config "$CT" | awk '/^cores:/ {print $2}')
    more=()
    want=$(( $(nproc 2>/dev/null || echo 2) < 2 ? $(nproc 2>/dev/null || echo 2) : 2 ))
    [ "${cur_cores:-0}" != "$want" ] && more+=(--cores "$want")
    if [ "${#more[@]}" -gt 0 ]; then
      pct set "$CT" "${more[@]}"
      say "Container $CT now uses $want CPU cores"
    fi
    # an update keeps everything from the existing install (token, Spotify, domain, name, auto updates)
    info "Updating Msik in container $CT"
    pct exec "$CT" -- bash -c "curl -fsSL $INSTALLER | bash -s -- --yes"
    say "Container $CT is up to date."
    install_notes
    show_backend "$CT"
    echo
    exit 0
  fi
fi

# ---------- defaults ----------
CTID=$(pvesh get /cluster/nextid)
HOST_CORES=$(nproc 2>/dev/null || echo 2); WANT_CORES=$(( HOST_CORES < 2 ? HOST_CORES : 2 ))
HN="msik"; CORES=$WANT_CORES; RAM=1024; DISK=6; BRIDGE="vmbr0"; NET="dhcp"; GATE=""; VLAN=""; PW=""
UNPRIV=1; AUTOUPDATE=1; DOMAIN=""; SP_ID=""; SP_SECRET=""; DNS=""

pick_storage() { # pick_storage CONTENT LABEL -> storage name
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

MODE=$(whiptail --backtitle "$TITLE" --title "Msik on Proxmox" --menu \
  "Creates a Debian 12 LXC container and installs the Msik music bot in it.\n\nDefaults: ID $CTID, $CORES CPU, 1 GB RAM, 6 GB disk, $BRIDGE with DHCP." 16 70 2 \
  "simple" "Use the defaults (recommended)" \
  "advanced" "Choose ID, resources, network and more" 3>&1 1>&2 2>&3) || cancel

if [ "$MODE" = advanced ]; then
  CTID=$(input "Container ID" "Container ID:" "$CTID"); num "$CTID" "Container ID"
  if pct status "$CTID" >/dev/null 2>&1 || qm status "$CTID" >/dev/null 2>&1; then die "ID $CTID is already in use."; fi
  HN=$(input "Hostname" "Hostname:" "$HN")
  CORES=$(input "CPU" "CPU cores:" "$CORES"); num "$CORES" "CPU cores"
  RAM=$(input "RAM" "RAM in MB (1024 is plenty):" "$RAM"); num "$RAM" "RAM"
  DISK=$(input "Disk" "Disk size in GB:" "$DISK"); num "$DISK" "Disk size"
  BRIDGE=$(input "Network" "Bridge:" "$BRIDGE")
  NET=$(input "Network" "IPv4: dhcp, or a static address with prefix (e.g. 192.168.1.50/24):" "$NET")
  if [ "$NET" != dhcp ]; then
    [[ "$NET" =~ ^[0-9.]+/[0-9]+$ ]] || die "Static IP needs a prefix, e.g. 192.168.1.50/24."
    GATE=$(input "Network" "Gateway (e.g. 192.168.1.1):" "")
    DNS=$(input "Network" "DNS server (empty = same as the Proxmox host):" "")
  fi
  VLAN=$(input "Network" "VLAN tag (empty = none):" "")
  [ -z "$VLAN" ] || num "$VLAN" "VLAN tag"
  yesno "Container type" "Unprivileged container? (recommended)" || UNPRIV=0
  PW=$(secret "Root password" "Root password for the console (empty = no password, use 'pct enter $CTID'):")
  DOMAIN=$(input "API address" "Own domain for HTTPS via Caddy, e.g. api.example.com\n(DNS A record + ports 80/443 to this container).\nEmpty = free Cloudflare tunnel." "")
  yesno "Updates" "Update the bot automatically? (checks every 15 minutes, waits while music plays)" || AUTOUPDATE=0
fi

TOKEN=""
while [ -z "$TOKEN" ]; do
  TOKEN=$(secret "Discord bot token" "Paste your bot token (right click or Ctrl+Shift+V).\n\nGet one at discord.com/developers/applications:\nNew Application -> Bot -> Reset Token -> Copy.")
  TOKEN="${TOKEN//[[:space:]]/}"
done
spotify

ROOTFS=$(pick_storage rootdir "container disk")
TMPL_STORE=$(pick_storage vztmpl "Debian template")

clear 2>/dev/null || true
printf "\n  ${c_b}%s${c_off}\n\n" "$TITLE"

# ---------- template ----------
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

# ---------- create ----------
net="name=eth0,bridge=$BRIDGE,ip=$NET"
[ -n "$GATE" ] && net="$net,gw=$GATE"
[ -n "$VLAN" ] && net="$net,tag=$VLAN"
opts=(
  --hostname "$HN" --cores "$CORES" --memory "$RAM" --swap 512
  --rootfs "$ROOTFS:$DISK" --net0 "$net" --ostype debian
  --unprivileged "$UNPRIV" --features nesting=1 --onboot 1 --tags msik
  --description "Msik music bot, installing ..."
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
say "Debian up to date"

# ---------- install Msik inside ----------
# The token goes in via a root-only file, so it never shows up in the host's process list.
tmp=$(mktemp); chmod 600 "$tmp"
printf 'TOKEN=%q\nSP_ID=%q\nSP_SECRET=%q\nDOMAIN=%q\n' "$TOKEN" "$SP_ID" "$SP_SECRET" "$DOMAIN" > "$tmp"
pct push "$CTID" "$tmp" /root/.msik-setup --perms 600
rm -f "$tmp"; unset TOKEN SP_SECRET

args="--yes --name $HN"
[ "$AUTOUPDATE" = 1 ] || args="$args --no-auto-update"
info "Installing Msik (Node.js, ffmpeg, bot) - takes a few minutes"
pct exec "$CTID" -- bash -c '
  set -e
  . /root/.msik-setup; rm -f /root/.msik-setup
  set -- '"$args"' --token "$TOKEN"
  [ -n "$DOMAIN" ] && set -- "$@" --domain "$DOMAIN"
  [ -n "$SP_ID" ] && set -- "$@" --spotify-id "$SP_ID"
  [ -n "$SP_SECRET" ] && set -- "$@" --spotify-secret "$SP_SECRET"
  curl -fsSL '"$INSTALLER"' | bash -s -- "$@"
'

install_notes

echo
printf " ${c_ok}${c_b}Msik is running in container %s${c_off}\n" "$CTID"
show_backend "$CTID"
echo
echo "  Shell:   pct enter $CTID"
echo "  Update:  run this script again (or it updates itself every 15 minutes)"
echo "  Remove:  pct stop $CTID && pct destroy $CTID"
echo "           (notes helper on the host: systemctl disable --now bot-notes.timer)"
echo
