@echo off
rem Starts the Msik music bot on Windows.
setlocal
cd /d "%~dp0"
title Msik

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found, installing Node.js LTS with winget ...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\nodejs"
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo.
  echo Enter your Discord bot token in .env and start again.
  notepad ".env"
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies ...
  call npm install --omit=dev --no-audit --no-fund
)

:run
node src\index.js
echo.
echo Bot stopped. Restarting in 5 seconds, close this window to quit.
timeout /t 5 >nul
goto run
