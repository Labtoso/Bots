#!/usr/bin/env bash
# Msik music bot for Proxmox VE: creates a Debian LXC container and installs the bot inside.
# Run in the Proxmox host shell (Datacenter -> your node -> Shell) as root:
#
#   bash -c "$(curl -fsSL https://bot.labtoso.de/proxmox.sh)"
#
# Run it again to update an existing Msik container or to create another one.
set -Eeuo pipefail

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
num()    { [[ "$1" =~ ^[0-9]+$ ]] || die "$2 must be a number (got \"$1\")."; }

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
    info "Updating Msik in container $CT"
    pct exec "$CT" -- bash -c "curl -fsSL $INSTALLER | bash -s -- --yes"
    say "Container $CT is up to date."
    exit 0
  fi
fi

# ---------- defaults ----------
CTID=$(pvesh get /cluster/nextid)
HN="msik"; CORES=1; RAM=1024; DISK=4; BRIDGE="vmbr0"; NET="dhcp"; GATE=""; VLAN=""; PW=""
UNPRIV=1; AUTOUPDATE=1; DOMAIN=""; SP_SECRET=""; DNS=""

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
  "Creates a Debian 12 LXC container and installs the Msik music bot in it.\n\nDefaults: ID $CTID, 1 CPU, 1 GB RAM, 4 GB disk, $BRIDGE with DHCP." 16 70 2 \
  "simple" "Use the defaults (recommended)" \
  "advanced" "Choose ID, resources, network and more" 3>&1 1>&2 2>&3) || cancel

if [ "$MODE" = advanced ]; then
  CTID=$(input "Container ID" "Container ID:" "$CTID"); num "$CTID" "Container ID"
  if pct status "$CTID" >/dev/null 2>&1 || qm status "$CTID" >/dev/null 2>&1; then die "ID $CTID is already in use."; fi
  HN=$(input "Hostname" "Hostname:" "$HN")
  CORES=$(input "CPU" "CPU cores:" "$CORES"); num "$CORES" "CPU cores"
  RAM=$(input "RAM" "RAM in MB (1024 is plenty, 512 also works):" "$RAM"); num "$RAM" "RAM"
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
if [ "$MODE" = advanced ]; then
  SP_SECRET=$(secret "Spotify (optional)" "Spotify Client secret for the Spotify search.\nThe Client ID is built in. Leave empty to skip.")
fi

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
  --description "Msik music bot. Logs: journalctl -u msik -f · Update: run the Proxmox script again · https://bot.labtoso.de"
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
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get -y -qq upgrade >/dev/null && apt-get install -y -qq curl ca-certificates >/dev/null"
say "Debian up to date"

# ---------- install Msik inside ----------
# The token goes in via a root-only file, so it never shows up in the host's process list.
tmp=$(mktemp); chmod 600 "$tmp"
printf 'TOKEN=%q\nSP_SECRET=%q\nDOMAIN=%q\n' "$TOKEN" "$SP_SECRET" "$DOMAIN" > "$tmp"
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
  [ -n "$SP_SECRET" ] && set -- "$@" --spotify-secret "$SP_SECRET"
  curl -fsSL '"$INSTALLER"' | bash -s -- "$@"
'

IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')
INVITE=$(pct exec "$CTID" -- bash -c "journalctl -u msik --no-pager -o cat 2>/dev/null | grep -o 'https://discord.com/[^ ]*' | tail -1" || true)

echo
printf " ${c_ok}${c_b}Msik is running in container %s${c_off}\n\n" "$CTID"
[ -n "$IP" ] && echo "  Container IP: $IP"
[ -n "$INVITE" ] && echo "  Invite link:  $INVITE"
echo "  Then join a voice channel in Discord and type /web."
echo
echo "  Logs:    pct exec $CTID -- journalctl -u msik -f"
echo "  Shell:   pct enter $CTID"
echo "  Update:  run this script again (or it updates itself every 15 minutes)"
echo "  Remove:  pct stop $CTID && pct destroy $CTID"
echo
