# Msik installer for Windows. No admin rights needed.
#
#   irm https://bot.labtoso.de/install.ps1 | iex
#
# Installs (or updates) the bot to %LOCALAPPDATA%\Msik with its own portable Node.js,
# asks for the bot token, opens the invite link, adds Start menu, desktop and autostart
# shortcuts and starts the bot. Run it again to update; settings are kept.
param(
  [string]$Token = $env:MSIK_TOKEN,
  [string]$SpotifyId = $env:MSIK_SPOTIFY_ID,
  [string]$SpotifySecret = $env:MSIK_SPOTIFY_SECRET,
  [string]$Dir = (Join-Path $env:LOCALAPPDATA 'Msik'),
  [switch]$NoStart,
  [switch]$NoShortcuts,
  [switch]$SkipTokenCheck
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Say($t) { Write-Host "==> $t" -ForegroundColor Green }
function Fail($t) { Write-Host $t -ForegroundColor Red; throw $t }

Write-Host ''
Write-Host '  Msik music bot installer' -ForegroundColor Cyan
Write-Host ''

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$envFile = Join-Path $Dir '.env'

# ---------- stop a running instance ----------
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -like "$Dir*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# ---------- token ----------
$haveToken = (Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^DISCORD_TOKEN=.+' -Quiet)
if (-not $Token -and -not $haveToken) {
  Write-Host 'You need a bot token:'
  Write-Host '  1. In the page that opens, click "New Application" and give it a name'
  Write-Host '  2. Left menu "Bot" -> "Reset Token" -> copy it'
  Write-Host ''
  Start-Process 'https://discord.com/developers/applications'
  $Token = (Read-Host 'Paste the bot token here').Trim()
  if (-not $Token) { Fail 'No token given.' }
}

$appId = $null
$botName = $null
if ($Token -and -not $SkipTokenCheck) {
  try {
    $me = Invoke-RestMethod -Uri 'https://discord.com/api/v10/users/@me' -Headers @{ Authorization = "Bot $Token" }
    $appId = $me.id
    $botName = $me.username
    Say "Token OK: $botName"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) { Fail 'This token is not valid. Copy it again with "Reset Token".' }
    Write-Host 'Could not check the token right now, continuing.' -ForegroundColor Yellow
  }
}

# ---------- Node.js (portable) ----------
$nodeDir = Join-Path $Dir 'node'
$node = Join-Path $nodeDir 'node.exe'
if (-not (Test-Path $node)) {
  Say 'Downloading Node.js'
  $rel = (Invoke-RestMethod 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
  $zip = Join-Path $env:TEMP "node-$($rel.version).zip"
  Invoke-WebRequest "https://nodejs.org/dist/$($rel.version)/node-$($rel.version)-win-x64.zip" -OutFile $zip -UseBasicParsing
  $tmp = Join-Path $env:TEMP "msik-node-$([guid]::NewGuid())"
  Expand-Archive $zip -DestinationPath $tmp -Force
  if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
  Move-Item (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName $nodeDir
  Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------- bot files ----------
Say 'Downloading Msik'
$zip = Join-Path $env:TEMP 'msik.zip'
Invoke-WebRequest 'https://github.com/Labtoso/Bots/archive/refs/heads/Msik.zip' -OutFile $zip -UseBasicParsing
$tmp = Join-Path $env:TEMP "msik-src-$([guid]::NewGuid())"
Expand-Archive $zip -DestinationPath $tmp -Force
$src = (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName
Copy-Item (Join-Path $src '*') $Dir -Recurse -Force
Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue

Say 'Installing dependencies'
$env:Path = "$nodeDir;$env:Path"
Push-Location $Dir
& (Join-Path $nodeDir 'npm.cmd') ci --omit=dev --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install failed.' }
Pop-Location

# ---------- settings ----------
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $Dir '.env.example') $envFile }
$lines = New-Object System.Collections.Generic.List[string]
foreach ($l in @(Get-Content $envFile)) { $lines.Add(($l -replace '^\uFEFF', '')) }
function Set-Env([string]$key, [string]$value) {
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].StartsWith("$key=")) { $lines[$i] = "$key=$value"; return }
  }
  $lines.Add("$key=$value")
}
function Get-Env([string]$key) {
  foreach ($l in $lines) { if ($l.StartsWith("$key=")) { return $l.Substring($key.Length + 1) } }
  return ''
}
if ($Token) { Set-Env 'DISCORD_TOKEN' $Token }
if (-not $SpotifySecret -and -not (Get-Env 'SPOTIFY_CLIENT_SECRET') -and -not $haveToken) {
  Write-Host ''
  Write-Host 'Spotify search (optional): the Client ID is built in, only the Client secret is needed.'
  Write-Host 'Press Enter to skip, you can add SPOTIFY_CLIENT_SECRET to .env later.'
  $SpotifySecret = (Read-Host 'Spotify Client secret (optional)').Trim()
}
if ($SpotifyId) { Set-Env 'SPOTIFY_CLIENT_ID' $SpotifyId }
if ($SpotifySecret) { Set-Env 'SPOTIFY_CLIENT_SECRET' $SpotifySecret }
if (-not (Get-Env 'BACKEND_NAME')) { Set-Env 'BACKEND_NAME' $env:COMPUTERNAME }
[IO.File]::WriteAllLines($envFile, $lines)

# ---------- launcher + shortcuts ----------
$launcher = Join-Path $Dir 'Msik.cmd'
@"
@echo off
title Msik
cd /d "%~dp0"
set "PATH=%~dp0node;%PATH%"
:run
node src\index.js
echo.
echo Bot stopped. Restarting in 5 seconds, close this window to quit.
timeout /t 5 >nul
goto run
"@ | Set-Content -Path $launcher -Encoding ASCII

@"
@echo off
rem Removes Msik from this PC.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://bot.labtoso.de/uninstall.ps1'))"
"@ | Set-Content -Path (Join-Path $Dir 'Uninstall.bat') -Encoding ASCII

if (-not $NoShortcuts) {
  $shell = New-Object -ComObject WScript.Shell
  $targets = @(
    @{ Path = (Join-Path ([Environment]::GetFolderPath('Programs')) 'Msik.lnk'); Style = 1 },
    @{ Path = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Msik.lnk'); Style = 1 },
    @{ Path = (Join-Path ([Environment]::GetFolderPath('Startup')) 'Msik.lnk'); Style = 7 }
  )
  foreach ($t in $targets) {
    $lnk = $shell.CreateShortcut($t.Path)
    $lnk.TargetPath = $launcher
    $lnk.WorkingDirectory = $Dir
    $lnk.WindowStyle = $t.Style
    $lnk.Description = 'Msik music bot'
    $lnk.Save()
  }
  Say 'Shortcuts created (Start menu, desktop, autostart)'
}

# ---------- invite ----------
if ($appId) {
  $invite = "https://discord.com/oauth2/authorize?client_id=$appId&scope=bot+applications.commands&permissions=3165184"
  Say 'Opening the invite link, pick your server there'
  Start-Process $invite
}

if (-not $NoStart) {
  Say 'Starting Msik'
  Start-Process -FilePath $launcher -WorkingDirectory $Dir -WindowStyle Minimized
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host '  Join a voice channel in Discord and type /web.'
Write-Host "  Installed in: $Dir"
Write-Host '  Update: run the installer again. Uninstall: Uninstall.bat in that folder.'
Write-Host ''
