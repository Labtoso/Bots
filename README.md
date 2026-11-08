# Msik

Discord-Musikbot mit einem einzigen Befehl: **`/web`**. Er schickt dir einen persönlichen Link zum Dashboard, und dort steuerst du alles: Suche, Warteschlange, Cover, Titel, Lautstärke, Wiederholen, Effekte und Autoplay.

Dashboard: https://bot.labtoso.de/Msik/ (Branch `gh-pages`, veröffentlicht über GitHub Actions)

## So hängt alles zusammen

```
Discord  ──/web──▶  Bot (dieser Branch, läuft bei dir)  ──Link mit Token──▶  Dashboard (GitHub Pages)
                         ▲                                                        │
                         └──────────── HTTPS-API + Live-Updates (SSE) ◀───────────┘
```

GitHub Pages liefert nur statische Dateien aus und kann keinen Bot ausführen. Darum läuft der Bot mit seiner kleinen API auf deinem PC oder Server. Das Dashboard holt sich die Adresse der API aus dem `/web`-Link und spricht direkt mit dem Bot.

Weil Pages über HTTPS läuft, braucht auch die API HTTPS. Das erledigt der Bot selbst: Er startet beim Hochfahren einen kostenlosen **Cloudflare Quick Tunnel** (ohne Konto) und baut dessen Adresse in jeden `/web`-Link ein. Nach einem Neustart ändert sich die Adresse, dann einfach `/web` neu ausführen.

## Installieren

**Windows** (ohne Admin-Rechte): PowerShell öffnen und einfügen

```
irm https://bot.labtoso.de/install.ps1 | iex
```

oder [`Install.bat`](https://bot.labtoso.de/Install.bat) herunterladen und doppelklicken. Der Installer öffnet das Discord Developer Portal, fragt nach dem Bot-Token, prüft ihn, öffnet den Einladungslink für deinen Server, legt Verknüpfungen im Startmenü, auf dem Desktop und im Autostart an und startet den Bot. Node.js bringt er selbst mit. Installiert wird nach `%LOCALAPPDATA%\Msik`.

**Linux / VPS** (Debian, Ubuntu, Fedora):

```
curl -fsSL https://bot.labtoso.de/install.sh | sudo bash
```

Fragt nach Token und optional einer Domain für die API. Mit Domain richtet er Caddy mit HTTPS ein (A-Record der Domain auf den Server, Ports 80/443 offen), ohne Domain nutzt er den Cloudflare-Tunnel. Der Bot läuft danach als Dienst `msik` und startet mit dem Server. Logs: `journalctl -u msik -f`.

**Automatische Updates (VPS):** Ein systemd-Timer schaut alle 15 Minuten, ob es auf dem Branch `Msik` etwas Neues gibt, holt es, installiert bei Bedarf neue Abhängigkeiten und startet den Bot neu. Läuft gerade Musik, wartet er damit (höchstens 6 Stunden). yt-dlp hält er dabei auch aktuell. Verlauf: `journalctl -u msik-update`, sofort prüfen: `sudo systemctl start msik-update`, abschalten: Installer mit `--no-auto-update` ausführen.

**Token vorher holen:** https://discord.com/developers/applications → **New Application** → **Bot** → **Reset Token**.

**Updaten:** Auf dem VPS automatisch, unter Windows den Installer nochmal ausführen. Die Einstellungen bleiben.
**Entfernen:** Windows `Uninstall.bat` im Installationsordner, Linux `curl -fsSL https://bot.labtoso.de/uninstall.sh | sudo bash`.

Danach in Discord in einen Sprachkanal gehen und `/web` eingeben. Unter Einstellungen → Backend im Dashboard kannst du zwischen mehreren Installationen wechseln (z. B. PC und VPS).

### Docker

```
git clone -b Msik https://github.com/Labtoso/Bots.git msik && cd msik
cp .env.example .env        # DISCORD_TOKEN, BACKEND_NAME und SESSION_SECRET eintragen
docker compose up -d --build                                                      # mit Tunnel
API_DOMAIN=api.example.com docker compose -f deploy/docker-compose.vps.yml up -d --build   # mit eigener Domain + HTTPS
```

## Mehrere Backends

Das Dashboard merkt sich jedes Backend, über dessen `/web`-Link du es geöffnet hast. In den Einstellungen kannst du zwischen ihnen wechseln, weitere Adressen hinzufügen oder entfernen. Feste Einträge für alle stehen in `Msik/backends.json` im Branch `gh-pages`. Der Name in der Liste kommt aus `BACKEND_NAME`.

## Feste Adresse (optional)

Mit einem eigenen Cloudflare Tunnel oder einem Server mit HTTPS `PUBLIC_URL=https://…` und `SESSION_SECRET=` (beliebiger langer Text) in `.env` setzen. Dann bleiben Links auch nach einem Neustart gültig.

## Funktionen

- Suche auf YouTube oder Link einfügen: YouTube (auch Playlists), SoundCloud, Bandcamp und alles, was yt-dlp kann, dazu Spotify-Titel, -Alben und -Playlists (werden über YouTube abgespielt)
- Cover und Titel für den aktuellen Song, die Warteschlange und den Verlauf
- Abspielen/Pause, Weiter, Zurück, Spulen, Lautstärke (0–150 %), Wiederholen (aus/Titel/Warteschlange), Mischen
- Warteschlange per Drag & Drop sortieren, „Als Nächstes“, „Jetzt abspielen“, Entfernen, Leeren
- Effekte: Bassboost, Nightcore, Vaporwave, 8D, Karaoke
- Autoplay mit ähnlichen Titeln, wenn die Warteschlange leer ist
- Live-Updates für alle, die das Dashboard offen haben
- Verlässt den Kanal nach 5 Minuten ohne Musik oder ohne Zuhörer
- Dashboard auf Deutsch und Englisch, drei Akzentfarben, fürs Handy angepasst

## Sicherheit

Jeder `/web`-Link enthält ein signiertes Token, das nur für dich und den einen Server gilt (Standard 12 Stunden). Die API nimmt nur Anfragen vom Dashboard an (`ALLOWED_ORIGINS`).

## Tests

```
npm test
```

Der Test startet die API ohne Discord (`MOCK=1`) und spielt echte Audiodateien über yt-dlp und ffmpeg ab. Dafür muss unter `http://127.0.0.1:9000` der Inhalt von `test/fixtures` laufen (`python -m http.server 9000` im Ordner, Dateien erzeugt `test/fixtures/make.sh`).

© LabtosoStudios
