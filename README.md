# Bots

Discord-Bots von LabtosoStudios. Jeder Bot hat seinen eigenen Branch, die Dashboards liegen auf `gh-pages`.

| Bot | Branch | Dashboard |
|---|---|---|
| Msik (Musik) | [`Msik`](../../tree/Msik) | https://bot.labtoso.de/Msik/ |

Dashboards: Branch [`gh-pages`](../../tree/gh-pages), veröffentlicht über GitHub Actions unter https://bot.labtoso.de.

## Msik installieren

Vorher einen Bot-Token holen: https://discord.com/developers/applications → **New Application** → **Bot** → **Reset Token**.

**Windows** (ohne Admin-Rechte, Node.js ist dabei), in PowerShell:

```
irm https://bot.labtoso.de/install.ps1 | iex
```

oder [`Install.bat`](https://bot.labtoso.de/Install.bat) herunterladen und doppelklicken.

**Linux / VPS** (Debian, Ubuntu, Fedora):

```
curl -fsSL https://bot.labtoso.de/install.sh | sudo bash
```

Der Installer fragt nach dem Token, installiert alles, öffnet bzw. zeigt den Einladungslink und startet den Bot mit dem System. Auf dem VPS aktualisiert sich der Bot danach alle 15 Minuten selbst und wartet dabei, bis keine Musik mehr läuft. Unter Windows zum Updaten den Installer nochmal ausführen.

Danach in Discord in einen Sprachkanal gehen und `/web` eingeben.

**Ausführlich, mit Einladen, Online-Check und Problemlösungen:** [Bot online bringen, Schritt für Schritt](../../tree/Msik#bot-online-bringen-schritt-f%C3%BCr-schritt) und die [Anleitung im Dashboard](https://bot.labtoso.de/Msik/#guide).
