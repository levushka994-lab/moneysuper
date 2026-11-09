#!/usr/bin/env bash
# AutoR → домашний сервер eta: свежий билд из GitHub в /srv/site-port/sites/autor.site-port.ru
# Ставится как /usr/local/bin/autor-eta-deploy (юнит autor-eta-sync.service + .timer)
set -euo pipefail

REPO_URL="${AUTOR_REPO_URL:-https://github.com/levushka994-lab/moneysuper.git}"
BRANCH="${AUTOR_BRANCH:-main}"
WORK="${AUTOR_WORK:-/opt/autor/repo}"
SITE="${AUTOR_SITE:-/srv/site-port/sites/autor.site-port.ru}"
STATE="${AUTOR_STATE:-/opt/autor/deployed.sha}"
LOCK="${AUTOR_LOCK:-/run/autor-eta.lock}"

mkdir -p "$(dirname "$WORK")" "$(dirname "$STATE")"
exec 9>"$LOCK"
flock -n 9 || exit 0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if [ -d "$WORK/.git" ]; then
  git -c safe.directory="$WORK" -C "$WORK" remote set-url origin "$REPO_URL"
  if ! git -c safe.directory="$WORK" -C "$WORK" fetch --depth 1 origin "$BRANCH" 2>/dev/null; then
    log "сеть недоступна, повтор на следующем запуске"
    exit 0
  fi
  git -c safe.directory="$WORK" -C "$WORK" reset --hard --quiet FETCH_HEAD
else
  rm -rf "$WORK"
  git clone --depth 1 --branch "$BRANCH" --quiet "$REPO_URL" "$WORK"
fi

SHORT=$(git -c safe.directory="$WORK" -C "$WORK" rev-parse --short HEAD 2>/dev/null || true)
SUM=$( { sha256sum "$WORK/index.html"; find "$WORK/assets" "$WORK/admin-app" -type f -exec sha256sum {} +; } | sort -k2 | sha256sum | cut -d' ' -f1)

if [ -f "$STATE" ] && [ "$(cat "$STATE")" = "$SUM" ]; then
  exit 0
fi

# Проверки: не выкладываем битый или неполный билд
SIZE=$(stat -c %s "$WORK/index.html" 2>/dev/null || echo 0)
[ "$SIZE" -ge 20000 ] || { log "ОШИБКА: index.html $SIZE байт — слишком мало"; exit 1; }
head -c 512 "$WORK/index.html" | grep -qiE '<!doctype html|<html' || { log "ОШИБКА: index.html не похож на HTML"; exit 1; }
grep -q 'assets/js/' "$WORK/index.html" || { log "ОШИБКА: index.html не ссылается на assets/"; exit 1; }
[ -d "$WORK/assets/css" ] && [ -d "$WORK/assets/js" ] || { log "ОШИБКА: нет assets/css или assets/js"; exit 1; }

mkdir -p "$SITE"
cp -f "$SITE/index.html" "$(dirname "$STATE")/index.prev.html" 2>/dev/null || true

rsync -a --delete \
  --exclude '.git' --exclude '*.sh' --exclude '*.ps1' --exclude 'README*' \
  --exclude '.gitattributes' --exclude '.gitignore' --exclude '.github' \
  --exclude 'tools' --exclude 'docs' \
  "$WORK"/ "$SITE"/

# Отпечаток сборки в ссылках на css/js — чтобы браузер не показывал старую версию
if [ -n "$SHORT" ]; then
  sed -i -E "s#(href=\"assets/[^\"]+\.css\")#\1?v=${SHORT}#g; s#(src=\"assets/[^\"]+\.js\")#\1?v=${SHORT}#g" "$SITE/index.html"
  sed -i -E "s#(href=\"admin\.css\")#\1?v=${SHORT}#g; s#(src=\"admin\.js\")#\1?v=${SHORT}#g" "$SITE/admin-app/index.html"
fi

find "$SITE" -type d -exec chmod 755 {} +
find "$SITE" -type f -exec chmod 644 {} +
chown -R site-port:site-port "$SITE"

echo "$SUM" > "$STATE"
FILES=$(find "$SITE" -type f | wc -l)
log "выложен $SHORT (index.html $SIZE байт, файлов $FILES)"
