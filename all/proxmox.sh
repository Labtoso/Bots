#!/usr/bin/env bash
# All Labtoso bots on Proxmox VE: Msik music bot and AIO bot together in one container called "Bots".
# Run in the Proxmox host shell (Datacenter -> your node -> Shell) as root:
#
#   bash -c "$(curl -fsSL https://bot.labtoso.de/all/proxmox.sh)"
#
# First run: creates the Msik container, then installs AIO into the same container and names it "Bots".
# Run it again: updates both bots without questions and prints all links again.
set -uo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Please run this as root in the Proxmox host shell."; exit 1; }
command -v pct >/dev/null || { echo "This is not a Proxmox VE host. Run it in the shell of your Proxmox node."; exit 1; }
c_b="\033[1m"; c_off="\033[0m"
step() { printf "\n${c_b}━━━ %s ━━━${c_off}\n\n" "$*"; }
get() { local t; t=$(mktemp); curl -fsSL "$1" -o "$t" || { echo "Download failed: $1"; rm -f "$t"; exit 1; }; echo "$t"; }

step "1/2 Msik (music bot)"
m=$(get https://bot.labtoso.de/proxmox.sh)
MSIK_AUTO_UPDATE=1 bash "$m" || { echo "Msik step failed, stopping here."; rm -f "$m"; exit 1; }
rm -f "$m"

step "2/2 AIO (all-in-one bot, goes into the Msik container)"
a=$(get https://bot.labtoso.de/AIO/proxmox.sh)
bash "$a"; rc=$?
rm -f "$a"
exit $rc
