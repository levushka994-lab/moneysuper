<#
  AutoR — ежедневный бэкап по расписанию (Планировщик заданий Windows).
  Запуск:
    powershell -ExecutionPolicy Bypass -File .\install-backup-task.ps1
  Другое время:  ... -File .\install-backup-task.ps1 -Time 09:30
  Нужен вход на сервер по SSH-ключу (без пароля) — иначе бэкап по расписанию не сможет войти.
  Если компьютер был выключен в назначенное время, бэкап сделается при следующем включении.
#>
param(
  [string]$Time = "21:00",
  [string]$Server = "root@site-port.ru"
)
$ErrorActionPreference = "Stop"
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$script = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "backup.ps1"
if (-not (Test-Path $script)) { Write-Host "Рядом нет файла backup.ps1." -ForegroundColor Red; exit 1 }

Write-Host "Проверяю вход на сервер по ключу ..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
ssh -o BatchMode=yes -o ConnectTimeout=15 $Server "true"
$code = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($code -ne 0) {
  Write-Host "`nВход без пароля не работает, поэтому бэкап по расписанию не сможет зайти на сервер." -ForegroundColor Red
  Write-Host "Настройте вход по SSH-ключу (см. README.txt, раздел 6 «Вход по ключу») и запустите этот файл снова."
  Write-Host "Бэкап вручную работает и с паролем: powershell -ExecutionPolicy Bypass -File .\backup.ps1"
  exit 1
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"{0}`" -Server {1} -Auto" -f $script, $Server)
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "AutoR backup" -Action $action -Trigger $trigger -Settings $settings -Description "Ежедневный бэкап сайта AutoR с сервера на этот компьютер" -Force | Out-Null

Write-Host "`nГотово: бэкап каждый день в $Time в папку $env:USERPROFILE\AutoR-backups" -ForegroundColor Green
Write-Host "Сделать бэкап прямо сейчас:   Start-ScheduledTask -TaskName 'AutoR backup'"
Write-Host "Убрать расписание:            Unregister-ScheduledTask -TaskName 'AutoR backup' -Confirm:`$false"
