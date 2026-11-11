# Removes AIO from this PC (files, shortcuts, autostart).
#   irm https://bot.labtoso.de/AIO/uninstall.ps1 | iex
$ErrorActionPreference = 'SilentlyContinue'
$Dir = Join-Path $env:LOCALAPPDATA 'AIO'
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.ExecutablePath -like "$Dir*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" |
  Where-Object { $_.CommandLine -like "*$Dir\AIO.cmd*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
foreach ($f in 'Programs', 'Desktop', 'Startup') {
  Remove-Item (Join-Path ([Environment]::GetFolderPath($f)) 'AIO.lnk') -Force
}
Start-Sleep -Seconds 1
Remove-Item $Dir -Recurse -Force
Write-Host 'AIO removed.' -ForegroundColor Green
