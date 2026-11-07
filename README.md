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

## Einrichten

1. https://discord.com/developers/applications → **New Application** → Name z. B. „Msik“.
2. **Bot** → **Reset Token** → Token kopieren.
3. **OAuth2 → URL Generator**: Scopes `bot` und `applications.commands`, Rechte `Connect`, `Speak`, `View Channels`. Link öffnen und den Bot auf deinen Server holen.
4. Starten:
   - **Windows:** `start.bat` doppelklicken. Beim ersten Mal öffnet sich `.env`, dort `DISCORD_TOKEN=` eintragen, speichern, nochmal starten. Node.js wird bei Bedarf per winget installiert, yt-dlp und cloudflared lädt der Bot selbst nach `bin/`.
   - **Linux:** `./start.sh`
   - **Docker:** `.env` anlegen (Vorlage `.env.example`), dann `docker compose up -d --build`.
5. In Discord in einen Sprachkanal gehen und `/web` eingeben.

## Auf einem VPS (empfohlen für Dauerbetrieb)

Du brauchst einen Linux-VPS (Debian/Ubuntu, 1 GB RAM reicht) und eine Subdomain für die API, z. B. `api.labtoso.de` mit einem **A-Record auf die IP des VPS**. Ports 80 und 443 müssen offen sein. Das HTTPS-Zertifikat holt Caddy automatisch.

**Mit Docker:**
```
git clone -b Msik https://github.com/Labtoso/Bots.git msik && cd msik
cp .env.example .env        # DISCORD_TOKEN, BACKEND_NAME=VPS und SESSION_SECRET eintragen
API_DOMAIN=api.labtoso.de docker compose -f deploy/docker-compose.vps.yml up -d --build
```

**Ohne Docker (systemd):**
```
curl -fsSL https://raw.githubusercontent.com/Labtoso/Bots/Msik/deploy/install-vps.sh | sudo bash -s -- --token <BOT_TOKEN> --domain api.labtoso.de --name VPS
```
Das Skript installiert Node.js, ffmpeg und Caddy, legt den Dienst `msik` an und startet ihn. Logs: `journalctl -u msik -f`, Update: Skript nochmal ausführen. Ohne `--domain` nutzt es den Cloudflare-Tunnel.

Danach im Dashboard unter **Einstellungen → Backend** die Adresse `https://api.labtoso.de` hinzufügen und in Discord `/web` ausführen.

## Mehrere Backends

Das Dashboard merkt sich jedes Backend, über dessen `/web`-Link du es geöffnet hast. In den Einstellungen kannst du zwischen ihnen wechseln (z. B. VPS und PC), weitere Adressen hinzufügen oder entfernen. Feste Einträge für alle stehen in `Msik/backends.json` im Branch `gh-pages`. Der Name in der Liste kommt aus `BACKEND_NAME`.

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
