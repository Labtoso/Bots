# Installs or updates all Labtoso bots on Windows: Msik (music) and AIO (all-in-one).
#   irm https://bot.labtoso.de/all/install.ps1 | iex
# Each bot asks for its own bot token. Run it again to update both, settings are kept.
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'
$ErrorActionPreference = 'Continue'
$failed = @()
function Step($t) { Write-Host ''; Write-Host "=== $t ===" -ForegroundColor Cyan; Write-Host '' }
function RunInstaller($name, $url) {
  # each installer runs in its own PowerShell, so one of them stopping does not end this script
  $cmd = "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('$url'))"
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $cmd -NoNewWindow -Wait -PassThru
  if ($p.ExitCode -ne 0) { $script:failed += $name }
}
Step '1/2 Msik (music bot)'
RunInstaller 'Msik' 'https://bot.labtoso.de/install.ps1'
Step '2/2 AIO (all-in-one bot)'
RunInstaller 'AIO' 'https://bot.labtoso.de/AIO/install.ps1'
Write-Host ''
if ($failed.Count -eq 0) { Write-Host 'Both bots are installed and up to date.' -ForegroundColor Green }
else { Write-Host ("Problem with: " + ($failed -join ', ') + ' (run this script again to retry)') -ForegroundColor Red }
Write-Host '  Msik: /web on your server'
Write-Host '  AIO:  /aio on your server'
Write-Host '  Update both: run this script again'
