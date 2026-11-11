# AIO bot installer for Windows. No extra rights needed.
#
#   irm https://bot.labtoso.de/AIO/install.ps1 | iex
#
# Installs (or updates) the bot to %LOCALAPPDATA%\AIO with its own portable Node.js,
# asks for the bot token, opens the invite link, adds Start menu, desktop and autostart
# shortcuts and starts the bot. It updates itself every 15 minutes; running this again also updates.
param(
  [string]$Token = $env:AIO_TOKEN,
  [string]$Dir = (Join-Path $env:LOCALAPPDATA 'AIO'),
  [switch]$NoStart,
  [switch]$NoShortcuts,
  [switch]$NoAutoUpdate,
  [switch]$SkipTokenCheck
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Say($t) { Write-Host "==> $t" -ForegroundColor Green }
function Fail($t) { Write-Host $t -ForegroundColor Red; throw $t }

Write-Host ''
Write-Host '  AIO bot installer' -ForegroundColor Cyan
Write-Host ''

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$envFile = Join-Path $Dir '.env'

# ---------- stop a running instance ----------
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -like "$Dir*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# ---------- token ----------
$haveToken = (Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^DISCORD_TOKEN=.+' -Quiet)
$appId = $null
while ($true) {
  if (-not $Token -and -not $haveToken) {
    Write-Host 'You need a bot token:'
    Write-Host '  1. In the page that opens, click "New Application" and give it a name'
    Write-Host '  2. Left menu "Bot" -> "Reset Token" -> copy it'
    Write-Host '  3. On the same page turn on "Server Members Intent" and "Message Content Intent"'
    Write-Host ''
    Start-Process 'https://discord.com/developers/applications'
    $Token = (Read-Host 'Paste the bot token here').Trim()
    if (-not $Token) { Fail 'No token given.' }
  }
  if (-not $Token -or $SkipTokenCheck) { break }
  try {
    $me = Invoke-RestMethod -Uri 'https://discord.com/api/v10/users/@me' -Headers @{ Authorization = "Bot $Token" }
    $appId = $me.id
    Say "Token OK: $($me.username)"
    break
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) { Write-Host 'This token does not work. Copy it again with "Reset Token".' -ForegroundColor Yellow; $Token = $null; continue }
    Write-Host 'Could not check the token right now, continuing.' -ForegroundColor Yellow
    break
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
  $tmp = Join-Path $env:TEMP "aio-node-$([guid]::NewGuid())"
  Expand-Archive $zip -DestinationPath $tmp -Force
  if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
  Move-Item (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName $nodeDir
  Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------- bot files ----------
Say 'Downloading AIO'
$sha = $null
try { $sha = (Invoke-RestMethod -Uri 'https://api.github.com/repos/Labtoso/Bots/commits/AIO' -Headers @{ 'User-Agent' = 'aio-installer' }).sha } catch { }
$ref = if ($sha) { $sha } else { 'refs/heads/AIO' }
$zip = Join-Path $env:TEMP 'aio.zip'
Invoke-WebRequest "https://github.com/Labtoso/Bots/archive/$ref.zip" -OutFile $zip -UseBasicParsing
$tmp = Join-Path $env:TEMP "aio-src-$([guid]::NewGuid())"
Expand-Archive $zip -DestinationPath $tmp -Force
$src = (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName
Copy-Item (Join-Path $src '*') $Dir -Recurse -Force
Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
if ($sha) { Set-Content -Path (Join-Path $Dir '.version') -Value $sha -NoNewline -Encoding ASCII }

Say 'Installing dependencies'
$env:Path = "$nodeDir;$env:Path"
Push-Location $Dir
& (Join-Path $nodeDir 'npm.cmd') ci --omit=dev --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install failed.' }
Pop-Location

# ---------- settings ----------
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $Dir '.env.example') $envFile }
$lines = New-Object System.Collections.Generic.List[string]
foreach ($l in @(Get-Content $envFile)) { $lines.Add(($l -replace '^﻿', '')) }
function Set-Env([string]$key, [string]$value) {
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].StartsWith("$key=")) { $lines[$i] = "$key=$value"; return } }
  $lines.Add("$key=$value")
}
function Get-Env([string]$key) {
  foreach ($l in $lines) { if ($l.StartsWith("$key=")) { return $l.Substring($key.Length + 1) } }
  return ''
}
if ($Token) { Set-Env 'DISCORD_TOKEN' $Token }
if (-not (Get-Env 'BACKEND_NAME')) { Set-Env 'BACKEND_NAME' $env:COMPUTERNAME }
if (-not (Get-Env 'SESSION_SECRET')) { Set-Env 'SESSION_SECRET' (-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })) }
if ($NoAutoUpdate) { Set-Env 'AUTO_UPDATE' '0' } elseif (-not (Get-Env 'AUTO_UPDATE')) { Set-Env 'AUTO_UPDATE' '1' }
[IO.File]::WriteAllLines($envFile, $lines)

# ---------- launcher + shortcuts ----------
$launcher = Join-Path $Dir 'AIO.cmd'
@"
@echo off
title AIO
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
rem Removes AIO from this PC.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://bot.labtoso.de/AIO/uninstall.ps1'))"
"@ | Set-Content -Path (Join-Path $Dir 'Uninstall.bat') -Encoding ASCII

if (-not $NoShortcuts) {
  $shell = New-Object -ComObject WScript.Shell
  $targets = @(
    @{ Path = (Join-Path ([Environment]::GetFolderPath('Programs')) 'AIO.lnk'); Style = 1 },
    @{ Path = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'AIO.lnk'); Style = 1 },
    @{ Path = (Join-Path ([Environment]::GetFolderPath('Startup')) 'AIO.lnk'); Style = 7 }
  )
  foreach ($t in $targets) {
    $lnk = $shell.CreateShortcut($t.Path)
    $lnk.TargetPath = $launcher
    $lnk.WorkingDirectory = $Dir
    $lnk.WindowStyle = $t.Style
    $lnk.Description = 'AIO Discord bot'
    $lnk.Save()
  }
  Say 'Shortcuts created (Start menu, desktop, autostart)'
}

# ---------- invite ----------
if ($appId) {
  $invite = "https://discord.com/oauth2/authorize?client_id=$appId&scope=bot+applications.commands&permissions=8"
  Say 'Opening the invite link, pick your server there'
  Start-Process $invite
}

if (-not $NoStart) {
  Say 'Starting AIO'
  Start-Process -FilePath $launcher -WorkingDirectory $Dir -WindowStyle Minimized
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host '  Type /aio on your Discord server to open the panel.'
Write-Host '  Remember: Developer Portal -> Bot -> turn on "Server Members Intent" and "Message Content Intent".' -ForegroundColor Yellow
Write-Host "  Installed in: $Dir"
Write-Host '  Updates: automatic every 15 minutes. Uninstall: Uninstall.bat in that folder.'
Write-Host ''
