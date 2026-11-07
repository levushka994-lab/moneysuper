#!/usr/bin/env bash
#
# AutoR — забрать свежий билд из GitHub и выложить на сайт.
#
# Запускается systemd-таймером autor-sync.timer (раз в минуту),
# можно запустить руками: autor-sync
#
# Логика: git fetch -> если коммит или файл изменились -> проверить,
# сохранить прошлую версию как index.prev.html и атомарно подменить index.html.
# Ничего не делает, если в репозитории нет изменений.
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
# ошибки сети логируем не чаще, чем раз в 10 минут
ERR_EVERY=600

log() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }

fail() {
  local msg="$1" now last
  now=$(date +%s)
  last=$(cat "$ERRSTAMP" 2>/dev/null || echo 0)
  if [ $((now - last)) -ge "$ERR_EVERY" ]; then
    log "ОШИБКА: $msg"
    echo "$now" > "$ERRSTAMP"
  fi
  exit 1
}

mkdir -p "$STATE_DIR"

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
SRC="$WORK/index.html"

# --- 2. Есть ли что выкладывать --------------------------------------------
[ -f "$SRC" ] || fail "в репозитории нет index.html"

# Сравниваем содержимое, а не только коммит: бывают коммиты, где сайт не менялся.
if cmp -s "$SRC" "$WEBROOT/index.html" 2>/dev/null; then
  if [ "$NEW_SHA" != "$OLD_SHA" ]; then echo "$NEW_SHA" > "$STATE"; fi
  exit 0
fi

# --- 3. Проверить, что это похоже на сайт ----------------------------------
SIZE=$(stat -c %s "$SRC")
if [ "$SIZE" -lt 100000 ]; then
  fail "index.html подозрительно маленький ($SIZE байт) — не выкладываю"
fi
if ! head -c 512 "$SRC" | grep -qi '<!doctype html\|<html'; then
  fail "index.html не похож на HTML — не выкладываю"
fi
if ! grep -q 'AutoR' "$SRC"; then
  fail "в index.html нет слова AutoR — не выкладываю"
fi

# --- 4. Выложить -----------------------------------------------------------
mkdir -p "$WEBROOT"
OLD_SUM="нет"
if [ -f "$WEBROOT/index.html" ]; then
  OLD_SUM=$(sha256sum "$WEBROOT/index.html" | cut -c1-12)
  cp -p "$WEBROOT/index.html" "$WEBROOT/index.prev.html"
fi

TMP="$WEBROOT/.index.html.tmp.$$"
install -m 644 "$SRC" "$TMP"
SRC_SUM=$(sha256sum "$SRC" | cut -d' ' -f1)
TMP_SUM=$(sha256sum "$TMP" | cut -d' ' -f1)
if [ "$SRC_SUM" != "$TMP_SUM" ]; then
  rm -f "$TMP"
  fail "контрольная сумма после копирования не совпала — оставляю прошлую версию"
fi
mv -f "$TMP" "$WEBROOT/index.html"

echo "$NEW_SHA" > "$STATE"
rm -f "$ERRSTAMP"
log "выложен $(git -C "$WORK" rev-parse --short HEAD) ($SIZE байт), прошлая версия $OLD_SUM"

# --- 5. Предупредить, если менялся установщик -------------------------------
if [ -f "$WORK/server-setup.sh" ]; then
  SETUP_SUM=$(sha256sum "$WORK/server-setup.sh" | cut -d' ' -f1)
  if [ -f "$SETUP_SHA_FILE" ] && [ "$(cat "$SETUP_SHA_FILE")" != "$SETUP_SUM" ]; then
    log "ВНИМАНИЕ: в репозитории изменился server-setup.sh — конфиг nginx сам не обновляю, запустите его вручную"
  fi
  echo "$SETUP_SUM" > "$SETUP_SHA_FILE"
fi
