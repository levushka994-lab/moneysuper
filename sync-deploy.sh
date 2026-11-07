#!/usr/bin/env bash
#
# AutoR — забрать свежий билд из GitHub и выложить на сайт.
#
# Запускается systemd-таймером autor-sync.timer (раз в минуту),
# можно запустить руками: autor-sync
#
# Что делает:
#   1. обновляет клон репозитория в /opt/autor/repo;
#   2. собирает из него «чистую» папку сайта (index.html + assets/, без служебных файлов);
#   3. если содержимое отличается от выложенного — проверяет сборку и подменяет
#      /var/www/autor целиком (атомарно, через переименование);
#   4. прошлый index.html остаётся рядом как index.prev.html для быстрого откката.
#
# Ничего не делает, если в репозитории нет изменений сайта.
#
set -euo pipefail

REPO_URL="${AUTOR_REPO_URL:-https://github.com/levushka994-lab/moneysuper.git}"
BRANCH="${AUTOR_BRANCH:-main}"
WORK="${AUTOR_WORK:-/opt/autor/repo}"
WEBROOT="${AUTOR_WEBROOT:-/var/www/autor}"
STATE="${AUTOR_STATE:-/opt/autor/deployed.sha}"
STATE_DIR="$(dirname "$STATE")"
SETUP_SHA_FILE="$STATE_DIR/server-setup.sha"
ERRSTAMP="$STATE_DIR/last-error"
STAGE="$WEBROOT.new"
# ошибки сети логируем не чаще, чем раз в 10 минут
ERR_EVERY=600

# служебные файлы репозитория, которым нечего делать на сайте
EXCLUDES=(--exclude=.git --exclude='*.ps1' --exclude='*.sh' --exclude='README*'
          --exclude='.gitattributes' --exclude='.gitignore' --exclude='.github')

log() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }

fail() {
  local msg="$1" now last
  now=$(date +%s)
  last=$(cat "$ERRSTAMP" 2>/dev/null || echo 0)
  if [ $((now - last)) -ge "$ERR_EVERY" ]; then
    log "ОШИБКА: $msg"
    echo "$now" > "$ERRSTAMP"
  fi
  rm -rf "$STAGE" 2>/dev/null || true
  exit 1
}

mkdir -p "$STATE_DIR"

# один экземпляр за раз: таймер может прийти, пока предыдущий ещё работает
exec 9>"/run/autor-sync.lock" 2>/dev/null || exec 9>"/tmp/autor-sync.lock"
flock -n 9 || exit 0

# --- 1. Забрать репозиторий -------------------------------------------------
# Плоский клон копит объекты при каждом fetch — если разросся, переклонируем.
GIT_MB=$(du -sm "$WORK/.git" 2>/dev/null | cut -f1 || true)
GIT_MB=${GIT_MB:-0}
if [ -d "$WORK/.git" ] && [ "$GIT_MB" -gt 100 ]; then
  log "рабочая копия разрослась (${GIT_MB} МБ) — переклонирую"
  rm -rf "$WORK"
fi

if [ ! -d "$WORK/.git" ]; then
  rm -rf "$WORK"
  git clone --depth 1 --branch "$BRANCH" -q "$REPO_URL" "$WORK" \
    || fail "не удалось склонировать $REPO_URL ($BRANCH)"
  log "клонирован $REPO_URL ($BRANCH)"
else
  git -C "$WORK" remote set-url origin "$REPO_URL" 2>/dev/null || true
  if ! git -C "$WORK" fetch --depth 1 -q origin "$BRANCH"; then
    fail "не удалось забрать $BRANCH из $REPO_URL"
  fi
  git -C "$WORK" reset --hard -q FETCH_HEAD || fail "не удалось переключиться на FETCH_HEAD"
fi

NEW_SHA=$(git -C "$WORK" rev-parse HEAD)
OLD_SHA=$(cat "$STATE" 2>/dev/null || true)

# --- 2. Собрать чистую папку сайта ------------------------------------------
[ -f "$WORK/index.html" ] || fail "в репозитории нет index.html"

rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -C "$WORK" "${EXCLUDES[@]}" -cf - . | tar -C "$STAGE" -xf - \
  || fail "не удалось собрать файлы сайта"

TREE_SUM=$(cd "$STAGE" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)

# Сравниваем содержимое, а не только коммит: бывают коммиты, где сайт не менялся.
if [ "$TREE_SUM" = "$OLD_SHA" ] && [ -f "$WEBROOT/index.html" ]; then
  rm -rf "$STAGE"
  exit 0
fi

# --- 3. Проверить, что это похоже на сайт ----------------------------------
SRC="$STAGE/index.html"
SIZE=$(stat -c %s "$SRC")
if [ "$SIZE" -lt 20000 ]; then
  fail "index.html подозрительно маленький ($SIZE байт) — не выкладываю"
fi
if ! head -c 512 "$SRC" | grep -qi '<!doctype html\|<html'; then
  fail "index.html не похож на HTML — не выкладываю"
fi
if ! grep -q 'AutoR' "$SRC"; then
  fail "в index.html нет слова AutoR — не выкладываю"
fi
if ! grep -q 'assets/css/' "$SRC" || ! grep -q 'assets/js/' "$SRC"; then
  fail "index.html не ссылается на assets/ — похоже на старую однофайловую сборку"
fi

# все локальные ссылки на стили и скрипты должны существовать в сборке
MISSING=$(grep -oE '(href|src)="[^"]+"' "$SRC" \
  | sed -E 's/.*="([^"]+)".*/\1/' \
  | grep -vE '^(https?:|data:|#|/)' || true)
while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  [ -f "$STAGE/$ref" ] || fail "в сборке нет файла $ref"
done <<< "$MISSING"

# --- 4. Выложить -----------------------------------------------------------
chmod -R a+rX "$STAGE"
find "$STAGE" -type d -exec chmod 755 {} +
find "$STAGE" -type f -exec chmod 644 {} +

# прошлая версия — рядом с новой, чтобы откат был в одну команду
OLD_SUM="нет"
if [ -f "$WEBROOT/index.html" ]; then
  OLD_SUM=$(sha256sum "$WEBROOT/index.html" | cut -c1-12)
  cp -p "$WEBROOT/index.html" "$STAGE/index.prev.html"
fi

PREV="$WEBROOT.prev"
rm -rf "$PREV"
if [ -d "$WEBROOT" ]; then
  mv "$WEBROOT" "$PREV" || fail "не удалось отложить прошлую версию"
fi
if ! mv "$STAGE" "$WEBROOT"; then
  [ -d "$PREV" ] && mv "$PREV" "$WEBROOT"
  fail "не удалось выложить новую версию — вернул прошлую"
fi
rm -rf "$PREV"

echo "$TREE_SUM" > "$STATE"
rm -f "$ERRSTAMP"
log "выложен $(git -C "$WORK" rev-parse --short HEAD) (index.html $SIZE байт, файлов $(find "$WEBROOT" -type f | wc -l)), прошлая версия $OLD_SUM"

# --- 5. Предупредить, если менялся установщик -------------------------------
if [ -f "$WORK/server-setup.sh" ]; then
  SETUP_SUM=$(sha256sum "$WORK/server-setup.sh" | cut -d' ' -f1)
  if [ -f "$SETUP_SHA_FILE" ] && [ "$(cat "$SETUP_SHA_FILE")" != "$SETUP_SUM" ]; then
    log "ВНИМАНИЕ: в репозитории изменился server-setup.sh — конфиг nginx сам не обновляю, запустите его вручную"
  fi
  echo "$SETUP_SUM" > "$SETUP_SHA_FILE"
fi
