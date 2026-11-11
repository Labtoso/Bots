@echo off
rem Installs or updates all Labtoso bots (Msik + AIO). Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://bot.labtoso.de/all/install.ps1'))"
pause
