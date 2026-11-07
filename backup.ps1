<#
  AutoR — бэкап сайта с сервера на этот компьютер.
  Вручную:
    powershell -ExecutionPolicy Bypass -File .\backup.ps1
  Куда: папка AutoR-backups в вашей папке пользователя (C:\Users\<имя>\AutoR-backups).
  Хранятся последние 30 архивов, более старые удаляются. Журнал — backup.log там же.
  В архиве: файлы сайта (/var/www/autor) и его настройка nginx (autor.conf).
#>
param(
  [string]$Server = "root@site-port.ru",
  [string]$Dest = (Join-Path $env:USERPROFILE "AutoR-backups"),
  [int]$Keep = 30,
  [switch]$Auto   # запуск по расписанию: без вопросов, вход только по ключу
)
$ErrorActionPreference = "Stop"
if (-not $Auto) { chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$log = Join-Path $Dest "backup.log"
function Log($msg) {
  Add-Content -Path $log -Value ("{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm"), $msg) -Encoding UTF8
  if (-not $Auto) { Write-Host $msg }
}

$opts = @()
if ($Auto) { $opts = @("-o", "BatchMode=yes", "-o", "ConnectTimeout=20") }
$file = Join-Path $Dest ("autor-{0}.tar.gz" -f (Get-Date -Format "yyyy-MM-dd_HH-mm"))
$remote = "/tmp/autor-backup.tar.gz"
$make = "cd / && ls -d var/www/autor etc/nginx/sites-available/autor.conf etc/nginx/conf.d/autor.conf 2>/dev/null | tar -czf $remote -T - && echo READY"

if (-not $Auto) { Write-Host "1/2  Собираю архив на сервере $Server ..." -ForegroundColor Yellow }
$res = & ssh @opts $Server $make
if ($LASTEXITCODE -ne 0 -or -not ($res -match "READY")) { Log "ОШИБКА: не удалось собрать архив на сервере (код $LASTEXITCODE)"; exit 1 }

if (-not $Auto) { Write-Host "2/2  Скачиваю на компьютер ..." -ForegroundColor Yellow }
& scp @opts -q "${Server}:$remote" "$file"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $file) -or (Get-Item $file).Length -eq 0) { Log "ОШИБКА: не удалось скачать архив"; exit 1 }

Log ("OK: {0} ({1} КБ)" -f $file, [math]::Round((Get-Item $file).Length / 1KB))
Get-ChildItem $Dest -Filter "autor-*.tar.gz" | Sort-Object Name -Descending | Select-Object -Skip $Keep | Remove-Item -Force
if (-not $Auto) { Write-Host "`nГотово. Все бэкапы: $Dest" -ForegroundColor Green }
