#!/usr/bin/env bash
# Installs or updates all Labtoso bots (Msik music bot + AIO bot) on Linux (VPS or desktop).
#
#   curl -fsSL https://bot.labtoso.de/all/install.sh | sudo bash
#
# Each bot asks for its own bot token (two Discord applications). Run it again to update both,
# everything set before is kept. Options are passed to both installers (e.g. --yes, --no-auto-update).
set -uo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Please run as root (sudo)."; exit 1; }
c_ok="\033[32m"; c_b="\033[1m"; c_err="\033[31m"; c_off="\033[0m"
step() { printf "\n${c_b}━━━ %s ━━━${c_off}\n\n" "$*"; }
fails=()
run() { # run NAME URL
  local tmp; tmp=$(mktemp)
  if ! curl -fsSL "$2" -o "$tmp"; then fails+=("$1 (download)"); rm -f "$tmp"; return; fi
  bash "$tmp" "${@:3}" || fails+=("$1")
  rm -f "$tmp"
}
step "1/2 Msik (music bot)"
run Msik https://bot.labtoso.de/install.sh "$@"
step "2/2 AIO (all-in-one bot)"
run AIO https://bot.labtoso.de/AIO/install.sh "$@"
echo
if [ "${#fails[@]}" -eq 0 ]; then
  printf "${c_ok}${c_b}Both bots are installed and up to date.${c_off}\n"
else
  printf "${c_err}Problem with: %s${c_off} (see the output above, run this script again to retry)\n" "${fails[*]}"
fi
echo "  Msik: /web on your server · logs: journalctl -u msik -f"
echo "  AIO:  /aio on your server · logs: journalctl -u aio -f"
echo "  Update both: run this script again"
