# Bots

Discord-Bots von LabtosoStudios. Jeder Bot hat seinen eigenen Branch, die Dashboards liegen auf `gh-pages`.

| Bot | Branch | Dashboard | Befehl | Port | Proxmox |
|---|---|---|---|---|---|
| Msik (Musik) | [`Msik`](../../tree/Msik) | https://bot.labtoso.de/Msik/ | `/web` | 8080 | eigener LXC (Tag `msik`) |
| AIO (All-in-One: Moderation, Level, Minecraft-Status, Embeds, Social-Alerts, Tickets u. v. m.) | [`AIO`](../../tree/AIO) | https://bot.labtoso.de/AIO/ | `/aio` | 8090 | in den Msik-Container dazu (heißt dann „Bots“), sonst eigener LXC (Tag `aio`) |

Dashboards: Branch [`gh-pages`](../../tree/gh-pages), veröffentlicht über GitHub Actions unter https://bot.labtoso.de.

## Msik installieren

Vorher einen Bot-Token holen: https://discord.com/developers/applications → **New Application** → **Bot** → **Reset Token**.

**Windows** (keine extra Rechte nötig, Node.js ist dabei), in PowerShell:

```
irm https://bot.labtoso.de/install.ps1 | iex
```

oder [`Install.bat`](https://bot.labtoso.de/Install.bat) herunterladen und doppelklicken.

**Linux / VPS** (Debian, Ubuntu, Fedora):

```
curl -fsSL https://bot.labtoso.de/install.sh | sudo bash
```

**Proxmox VE** (eigener LXC-Container), in der Shell des Proxmox-Hosts:

```
bash -c "$(curl -fsSL https://bot.labtoso.de/proxmox.sh)"
```

Der Installer fragt nach dem Token, installiert alles, öffnet bzw. zeigt den Einladungslink und startet den Bot mit dem System. Auf dem VPS aktualisiert sich der Bot danach alle 15 Minuten selbst und wartet dabei, bis keine Musik mehr läuft. Unter Windows zum Updaten den Installer nochmal ausführen.

Danach in Discord in einen Sprachkanal gehen und `/web` eingeben. Der Link verbindet das Dashboard automatisch mit deinem Bot (grüner Punkt oben rechts = verbunden). Genaueres unter [Backend verbinden](https://github.com/Labtoso/Bots/tree/Msik#7-backend-verbinden).

**Ausführlich, mit Einladen, Online-Check und Problemlösungen:** [Bot online bringen, Schritt für Schritt](../../tree/Msik#bot-online-bringen-schritt-f%C3%BCr-schritt) und die [Anleitung im Dashboard](https://bot.labtoso.de/Msik/#guide).

## AIO installieren

Eigene Application mit eigenem Token anlegen (nicht die von Msik) und im Developer Portal unter **Bot** die Schalter **Server Members Intent** und **Message Content Intent** einschalten.

| System | Befehl |
|---|---|
| Windows (PowerShell) | `irm https://bot.labtoso.de/AIO/install.ps1 \| iex` oder [`Install.bat`](https://bot.labtoso.de/AIO/Install.bat) |
| Linux / VPS | `curl -fsSL https://bot.labtoso.de/AIO/install.sh \| sudo bash` |
| Proxmox VE (Shell der Node) | `bash -c "$(curl -fsSL https://bot.labtoso.de/AIO/proxmox.sh)"` |

Nochmal ausführen = Update, alle Einstellungen bleiben. Updates laufen außerdem alle 15 Minuten von selbst. Danach auf dem Discord-Server `/aio` eingeben, der Link verbindet das Panel automatisch.

## Beide Bots auf Proxmox

- Läuft Msik schon in einem Container, legt das AIO-Script **keinen neuen Container** an. Es installiert AIO dort dazu und benennt den Container in **„Bots“** um. Kerne und RAM bleiben, wie sie sind. Mit `AIO_NEW=1 bash -c "$(curl -fsSL https://bot.labtoso.de/AIO/proxmox.sh)"` gibt es trotzdem einen eigenen Container.
- Am Ende jedes Laufs (neu, Update, dazuinstalliert) stehen in der Node-Shell für jeden Bot im Container alle Links: Dashboard bzw. Panel, Backend-Adresse, Einladungslink, Befehl und Log-Befehl.
- Dieselben Links stehen in den Container-Notizen (Container → Übersicht → Notizen) und aktualisieren sich alle 2 Minuten (`bot-notes.timer` auf dem Host).
- Auf Linux und Windows laufen beide Bots ohnehin nebeneinander (eigene Ordner, Ports 8080 und 8090).
