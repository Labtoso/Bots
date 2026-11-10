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

## Bot online bringen, Schritt für Schritt

Du brauchst etwa 5 Minuten. Am Ende ist der Bot auf deinem Server online, und `/web` öffnet das Dashboard.

### 1. Discord-Anwendung anlegen

1. Öffne https://discord.com/developers/applications und melde dich mit deinem Discord-Konto an.
2. Klick oben rechts auf **New Application**, gib einen Namen ein (z. B. `Msik`), hak die Bedingungen ab und klick **Create**.
3. Optional: Unter **General Information** ein Bild als App-Icon hochladen. So sieht der Bot später in Discord aus.

### 2. Token kopieren

1. Links auf **Bot** klicken.
2. Bei **Token** auf **Reset Token** klicken, bestätigen und den Token mit **Copy** kopieren.
3. Der Token ist das Passwort des Bots. Gib ihn nie weiter und lade ihn nirgends hoch. Wenn er doch mal irgendwo auftaucht, einfach nochmal **Reset Token**, dann ist der alte ungültig.
4. Die drei **Privileged Gateway Intents** (Presence, Server Members, Message Content) brauchst du **nicht**, lass sie aus.

### 3. Installieren

**Windows** (keine extra Rechte nötig, Node.js ist dabei). PowerShell öffnen (Start → „PowerShell“) und einfügen:

```
irm https://bot.labtoso.de/install.ps1 | iex
```

oder [`Install.bat`](https://bot.labtoso.de/Install.bat) herunterladen und doppelklicken. Der Installer fragt nach dem Token (mit Rechtsklick einfügen), prüft ihn, installiert alles nach `%LOCALAPPDATA%\Msik`, legt Verknüpfungen im Startmenü, auf dem Desktop und im Autostart an und startet den Bot in einem kleinen Fenster „Msik“. Solange dieses Fenster offen ist, ist der Bot online.

**Linux / VPS** (Debian, Ubuntu, Fedora), per SSH auf dem Server:

```
curl -fsSL https://bot.labtoso.de/install.sh | sudo bash
```

Er fragt nach dem Token und nach einer Domain. Die Domain ist optional:

- **Mit Domain** (z. B. `api.example.com`): Lege vorher beim Domain-Anbieter einen **A-Record** auf die IP des Servers an, und Ports 80 und 443 müssen offen sein. Der Installer richtet dann Caddy mit HTTPS ein, und die Adresse bleibt immer gleich.
- **Ohne Domain** (einfach Enter): Der Bot nutzt einen kostenlosen Cloudflare-Tunnel. Das geht sofort, aber die Adresse ändert sich bei jedem Neustart. Danach einfach `/web` neu ausführen.

Der Bot läuft danach als Dienst `msik`, startet mit dem Server und holt sich alle 15 Minuten selbst Updates (siehe unten).

**Proxmox VE** (eigener LXC-Container), in der Shell des Proxmox-Hosts (Node → Shell):

```
bash -c "$(curl -fsSL https://bot.labtoso.de/proxmox.sh)"
```

Das Script legt einen Debian-12-Container an (Standard: 1 CPU, 1 GB RAM, 4 GB Disk, `vmbr0` mit DHCP, startet mit dem Host) und führt darin den Linux-Installer aus. Mit **Erweitert** wählst du Container-ID, Hostname, Ressourcen, Storage, statische IP, VLAN, Root-Passwort, Domain und Auto-Updates. Danach fragt es nach dem Bot-Token und nach Spotify Client ID und Client Secret (jeweils mit Enter überspringen, ohne ID nimmt es die eingebaute), fertig. Beim Update fragt es danach, falls noch kein Secret eingetragen ist. Logs: `pct exec <ID> -- journalctl -u msik -f`. Die Backend-Adresse zum Kopieren zeigt das Script am Ende an, und sie steht in Proxmox beim Container unter **Übersicht → Notizen** (ein kleiner Timer `msik-notes.timer` auf dem Host hält sie aktuell, auch wenn sich die Tunnel-Adresse nach einem Neustart ändert). Nochmal ausführen bietet an, den vorhandenen Container zu aktualisieren.

### 4. Bot auf deinen Server einladen

- **Windows:** Der Installer öffnet den Einladungslink automatisch im Browser.
- **Linux:** Der Link steht am Ende der Installation und im Log: `journalctl -u msik | grep Einladen`.
- **Von Hand:** Im Developer Portal unter **OAuth2 → URL Generator** die Scopes `bot` und `applications.commands` anhaken, bei den Rechten **View Channels**, **Connect** und **Speak**. Unten den Link kopieren und öffnen.

Im Browser wählst du den Server aus und klickst **Autorisieren**. Dafür brauchst du auf dem Server das Recht „Server verwalten“.

### 5. Prüfen, ob der Bot online ist

- In Discord steht der Bot rechts in der Mitgliederliste mit **grünem Punkt** und dem Status **„Spielt /web“**.
- **Windows:** Im Fenster „Msik“ stehen `Eingeloggt als …` und `/web registriert`.
- **Linux:** `systemctl status msik` zeigt `active (running)`, live mitlesen mit `journalctl -u msik -f`.

### 6. Dashboard öffnen

1. Geh in Discord in einen Sprachkanal.
2. Tipp `/web` und wähl den Befehl von deinem Bot aus. Beim allerersten Start kann es ein paar Minuten dauern, bis Discord den Befehl anzeigt. Notfalls Discord mit Strg+R neu laden.
3. Klick auf **Dashboard öffnen**. Der Link gilt 12 Stunden und nur für dich.
4. Oben rechts im Dashboard zeigt ein **grüner Punkt**, dass die Verbindung zum Bot steht. Das Backend steht ab jetzt unter Einstellungen → Backend.
5. Oben einen Song suchen und auf **+** klicken. Der Bot kommt in deinen Sprachkanal und spielt.

### 7. Backend verbinden

**Das passiert automatisch.** Im `/web`-Link steckt die Adresse deines Backends (also deines laufenden Bots) und dein Zugang. Das Dashboard verbindet sich damit von selbst und merkt sich das Backend. Du musst nichts eintragen.

- **Woran sehe ich, dass es verbunden ist?** Oben rechts neben deinem Server ist ein **grüner Punkt**. Rot heißt: keine Verbindung.
- **Wo steht es?** Zahnrad → **Backend**. Dort steht dein Backend mit grünem Punkt. Hast du mehrere (z. B. PC und VPS), klickst du hier zum Wechseln.
- **Von Hand hinzufügen** brauchst du nur für ein weiteres Backend. Die Adresse ist:
  - VPS mit Domain: `https://api.deinedomain.de`
  - Mit Tunnel (PC oder VPS ohne Domain): die `https://….trycloudflare.com`-Adresse, die der Bot als `Öffentliche API-Adresse` ausgibt. Windows: im Fenster „Msik“. Linux: `journalctl -u msik | grep API`.
  
  Danach einmal `/web` von diesem Bot ausführen, denn erst der Link gibt dir den Zugang.
- **Kein grüner Punkt?** Der Bot ist offline oder wurde neu gestartet (beim Tunnel ändert sich dann die Adresse). Einfach `/web` nochmal ausführen.

### Probleme lösen

| Problem | Lösung |
|---|---|
| Bot bleibt offline | Läuft das Fenster „Msik“ bzw. der Dienst? Steht im Log `Token ungültig`, ist der Token falsch: neuen holen (Reset Token) und den Installer nochmal ausführen. |
| `/web` taucht nicht auf | Bot mit dem Scope `applications.commands` neu einladen (Schritt 4), Discord mit Strg+R neu laden, ein paar Minuten warten. |
| Dashboard zeigt „Bot nicht erreichbar“ oder roten Punkt | Der Bot ist offline oder wurde neu gestartet (beim Tunnel ändert sich dann die Adresse). Einfach `/web` nochmal ausführen. |
| „Geh zuerst in einen Sprachkanal“ | Du musst selbst in einem Sprachkanal sein, wenn du den ersten Song hinzufügst. |
| Kein Ton | Der Bot braucht im Kanal die Rechte **Verbinden** und **Sprechen**. Lautstärke im Dashboard prüfen. |
| Domain klappt nicht (VPS) | A-Record zeigt auf die Server-IP? Ports 80/443 offen? `journalctl -u caddy` zeigt Zertifikatsfehler. |

## Updates und Entfernen

**Automatische Updates (VPS):** Ein systemd-Timer schaut alle 15 Minuten, ob es auf dem Branch `Msik` etwas Neues gibt, holt es, installiert bei Bedarf neue Abhängigkeiten und startet den Bot neu. Läuft gerade Musik, wartet er damit (höchstens 6 Stunden). yt-dlp hält er dabei auch aktuell. Verlauf: `journalctl -u msik-update`, sofort prüfen: `sudo systemctl start msik-update`, abschalten: Installer mit `--no-auto-update` ausführen.

**Windows:** Zum Updaten den Installer nochmal ausführen. Token und Einstellungen bleiben.

**Entfernen:** Windows `Uninstall.bat` im Ordner `%LOCALAPPDATA%\Msik`, Linux `curl -fsSL https://bot.labtoso.de/uninstall.sh | sudo bash`.

Unter Einstellungen → Backend im Dashboard kannst du zwischen mehreren Installationen wechseln (z. B. PC und VPS).

## Spotify-Suche (optional)

In den Einstellungen des Dashboards schaltest du bei **Suche über** zwischen YouTube und Spotify um. Spotify liefert nur Titel und Cover, abgespielt wird über YouTube. Spotify-Links (Track, Album, Playlist) gehen immer, auch ohne Einrichtung.

Die Client ID der Msik-App ist schon eingebaut. Für die Spotify-Suche fehlt nur noch das **Client secret**: Der Installer fragt bei der Erstinstallation danach, sonst in `.env` eintragen und den Bot neu starten:

```
SPOTIFY_CLIENT_SECRET=...
```

Wer eine eigene Spotify-App nutzen will (https://developer.spotify.com/dashboard, **Create app**, Haken bei **Web API**), trägt zusätzlich `SPOTIFY_CLIENT_ID=...` ein.
   Windows: `%LOCALAPPDATA%\Msik\.env`, Linux: `/opt/msik/.env`, dann `sudo systemctl restart msik`.

## Docker

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
