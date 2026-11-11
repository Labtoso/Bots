#!/usr/bin/env bash
# Writes the backend addresses of the Msik and AIO bots into the container Notes on a Proxmox host
# (Proxmox UI: container -> Summary). One helper for both bots, so a container that runs both
# gets one note with both addresses instead of two helpers overwriting each other.
#
#   bot-notes               all running containers tagged "msik" or "aio"
#   bot-notes aio 105       only container 105, prints "<ID> <AIO backend address>"
#   bot-notes msik          all Msik containers, prints "<ID> <Msik backend address>"
set -uo pipefail

only=""
case "${1:-}" in msik|aio) only="$1"; shift ;; esac
state=/run/bot-notes; mkdir -p "$state"
ids="$*"; [ -n "$ids" ] || ids=$(pct list 2>/dev/null | awk 'NR>1 && $2=="running" {print $1}')

in_ct() { pct exec "$1" -- sh -c "$2" 2>/dev/null; }
address() { # address CTID BOT
  in_ct "$1" 'u=$(grep -m1 "^PUBLIC_URL=" /opt/'"$2"'/.env 2>/dev/null | cut -d= -f2-); [ -n "$u" ] && echo "$u" || journalctl -u '"$2"' -b --no-pager -o cat 2>/dev/null | grep -a "API-Adresse" | grep -o "https://[^ ]*" | tail -1'
}
invite() { in_ct "$1" 'journalctl -u '"$2"' --no-pager -o cat 2>/dev/null | grep -o "https://discord.com/oauth2/[^ ]*" | tail -1'; }

section() { # section BOT URL INVITE
  local inv="steht nach dem Start im Log"
  [ -n "$3" ] && inv="[Einladungslink]($3)"
  if [ "$1" = msik ]; then
    printf '%s' "## 🎵 Msik Musikbot

**Backend-Adresse** (zum Kopieren, im Dashboard unter Einstellungen → Backend einfügen):

\`\`\`
${2:-wird noch ermittelt, Bot startet gerade ...}
\`\`\`

- Dashboard: [bot.labtoso.de/Msik](https://bot.labtoso.de/Msik/)
- Bot einladen: $inv
- Danach in Discord in einen Sprachkanal gehen und \`/web\` eingeben (der Link verbindet das Backend automatisch).
- Logs: \`journalctl -u msik -f\` (Konsole des Containers)"
  else
    printf '%s' "## 🤖 AIO Discord-Bot

**Backend-Adresse** (zum Kopieren, im Panel über das Server-Symbol oben rechts einfügen):

\`\`\`
${2:-wird noch ermittelt, Bot startet gerade ...}
\`\`\`

- Panel: [bot.labtoso.de/AIO](https://bot.labtoso.de/AIO/)
- Bot einladen: $inv
- Danach auf deinem Discord-Server \`/aio\` eingeben (der Link verbindet das Backend automatisch).
- Logs: \`journalctl -u aio -f\` (Konsole des Containers)"
  fi
}

for id in $ids; do
  tags=" $(pct config "$id" 2>/dev/null | sed -n 's/^tags: *//p' | tr ';,' '  ') "
  bots=""
  for b in msik aio; do [[ "$tags" == *" $b "* ]] && bots="$bots $b"; done
  [ -n "$bots" ] || continue
  [ -z "$only" ] || [[ "$bots" == *" $only"* ]] || continue
  [ "$(pct status "$id" 2>/dev/null | awk '{print $2}')" = running ] || continue

  desc=""
  for b in $bots; do
    in_ct "$id" "test -d /opt/$b" || continue # tag left over after an uninstall
    url=$(address "$id" "$b"); inv=$(invite "$id" "$b")
    if [ -n "$only" ]; then [ "$b" = "$only" ] && echo "$id ${url:-}"; else echo "$id $b ${url:-}"; fi
    [ -z "$desc" ] || desc="$desc

---

"
    desc="$desc$(section "$b" "$url" "$inv")"
  done
  [ -n "$desc" ] || continue
  ip=$(pct exec "$id" -- hostname -I 2>/dev/null | awk '{print $1}')
  desc="$desc

---

Container-IP: ${ip:-?} · Update: Proxmox-Script nochmal ausführen (Bots updaten sich auch selbst alle 15 Minuten)

_Die Adressen aktualisieren sich hier alle 2 Minuten von selbst (bot-notes.timer auf dem Host)._"

  sum=$(printf '%s' "$desc" | md5sum | cut -d' ' -f1)
  [ "$(cat "$state/$id" 2>/dev/null)" = "$sum" ] && continue
  pct set "$id" --description "$desc" && echo "$sum" > "$state/$id"
done
exit 0
