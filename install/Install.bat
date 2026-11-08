@echo off
rem Installs or updates the Msik music bot. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://bot.labtoso.de/install.ps1'))"
pause
