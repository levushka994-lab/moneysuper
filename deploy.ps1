<#
  AutoR — выкладка сайта на сервер.
  Запуск из папки с этим файлом:
    powershell -ExecutionPolicy Bypass -File .\deploy.ps1
  Первый раз — установит сайт (сначала покажет, что нашёл на сервере, и спросит «Продолжить?»).
  Повторно — просто обновит сайт новой версией index.html.
  Пароль сервера спросит два раза, если вход не по SSH-ключу.
#>
param(
  [string]$Server = "root@site-port.ru",
  [string]$Domain = "site-port.ru",
  [string]$Email = ""
)
$ErrorActionPreference = "Stop"
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Fail($msg) { Write-Host "`n$msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  Fail "Не найден ssh. Установите «Клиент OpenSSH»: Параметры → Приложения → Дополнительные компоненты."
}
foreach ($f in "index.html", "server-setup.sh") {
  if (-not (Test-Path (Join-Path $here $f))) { Fail "Рядом со скриптом нет файла $f." }
}
if (-not (Test-Path (Join-Path $here "assets"))) {
  Fail "Рядом со скриптом нет папки assets (стили и скрипты сайта)."
}

# Папка autor (сайт + установщик) уезжает на сервер в /tmp/autor
$tmp = Join-Path $here "upload"
$pack = Join-Path $tmp "autor"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $pack | Out-Null
Copy-Item (Join-Path $here "index.html") $pack
Copy-Item (Join-Path $here "assets") (Join-Path $pack "assets") -Recurse
# установщику нужны переводы строк Linux
$sh = [IO.File]::ReadAllText((Join-Path $here "server-setup.sh")) -replace "`r`n", "`n"
[IO.File]::WriteAllText((Join-Path $pack "server-setup.sh"), $sh, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "`n1/2  Копирую сайт на сервер $Server ..." -ForegroundColor Yellow
scp -r -q "$pack" "${Server}:/tmp/"
if ($LASTEXITCODE -ne 0) { Fail "Не удалось скопировать файлы. Проверьте адрес сервера и пароль." }

Write-Host "2/2  Устанавливаю на сервере ..." -ForegroundColor Yellow
ssh -t $Server "bash /tmp/autor/server-setup.sh '$Domain' '$Email'"
$code = $LASTEXITCODE
Remove-Item $tmp -Recurse -Force
if ($code -ne 0) { Fail "Установка не завершена — пришлите мне вывод выше." }
Write-Host "`nГотово." -ForegroundColor Green
