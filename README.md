# AIO

All-in-one Discord bot with a web panel at <https://bot.labtoso.de/AIO/>. The only command you need is `/aio`: it sends you a personal link that opens the panel and connects it to your backend automatically.

## Modules

| Module | What it does |
| --- | --- |
| Moderation | `/ban` (also temporary), `/unban`, `/kick`, `/softban`, `/timeout`, `/warn`, `/warnings`, `/purge`, `/slowmode`, `/lock`, cases, mod log, DM to the member, automatic steps after X warnings |
| Auto-Mod | bad words (with tricks like 4→a), invites, links with allow list, caps, mentions, emojis, spam, repeats, line spam, zalgo, repeat offenders |
| Logs | deleted/edited messages, joins, leaves, bans, roles, nicknames, timeouts, channels, roles, voice, invites; one channel per category |
| Welcome | welcome and goodbye messages, DM, auto roles for members and bots |
| Level & XP | XP for messages and voice, level-up message, level roles, XP bonus roles, `/rank`, `/leaderboard`, `/xp` |
| Reaction roles | reactions, buttons or select menu; toggle, unique, add only, remove only |
| Custom commands | slash commands, prefix commands and auto replies with text or embed, roles, cooldowns, random answers |
| Embed editor | build, send and edit embeds with live preview, style profiles (colour, author, footer, images), templates |
| Minecraft | Java + Bedrock status, live players, 24 h / 7 day online timeline, self-updating status message, online/offline alerts, channel name counters, `/mc` |
| Social alerts | YouTube, Twitch, Kick, Reddit, Bluesky, any RSS feed, no API keys |
| Scheduled messages | every X minutes, daily, weekdays or once |
| Birthdays | `/geburtstag`, greeting and birthday role |
| Tickets | button panel, private ticket channels, claim, transcript |
| Giveaways | button entry, role requirement, reroll |
| More | starboard, statistic channels, join-to-create voice channels, `/umfrage` polls, bot name, avatar and rotating status from the panel |

## Install

Turn on **Server Members Intent** and **Message Content Intent** in the Discord Developer Portal (Bot page) first.

| | |
| --- | --- |
| Windows | `irm https://bot.labtoso.de/AIO/install.ps1 \| iex` (or `Install.bat`) |
| Linux / VPS | `curl -fsSL https://bot.labtoso.de/AIO/install.sh \| sudo bash` |
| Proxmox VE | `bash -c "$(curl -fsSL https://bot.labtoso.de/AIO/proxmox.sh)"` in the node shell |

The installers ask for the bot token. Running them again updates the bot and keeps all settings. Updates also happen on their own every 15 minutes (Linux: systemd timer, Windows: the bot itself). On Proxmox the backend address is printed in the shell at the end and kept up to date in the container notes.

## Development

```
npm install
npm test
```
