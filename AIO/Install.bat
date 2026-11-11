@echo off
rem Installs or updates the AIO Discord bot. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://bot.labtoso.de/AIO/install.ps1'))"
pause
