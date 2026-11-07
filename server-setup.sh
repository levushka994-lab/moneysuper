#!/usr/bin/env bash
# AutoR — установка или обновление сайта на сервере.
# Запускается из deploy.ps1:  bash /tmp/autor/server-setup.sh <домен> [email для HTTPS]
#
# Бережно к серверу, на котором уже может что-то работать:
#  - сначала показывает, что нашёл, и спрашивает подтверждение;
#  - останавливается, если порт 80 занят не nginx или домен уже настроен в другом конфиге;
#  - предупреждает, если на домене уже открывается какой-то сайт;
#  - файрвол не включает и не меняет, только открывает 80/443, если он уже включён;
#  - при ошибке в конфиге nginx откатывает свой файл.
set -euo pipefail

DOMAIN="${1:?Укажите домен: server-setup.sh site.ru [email]}"
EMAIL="${2:-}"
SRC=/tmp/autor
ROOT=/var/www/autor

say()  { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
ok()   { printf '\033[1;32m   ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;35m   ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n\n' "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Нужны права root."
[ -f "$SRC/index.html" ] || die "Нет файла $SRC/index.html. Запустите deploy.ps1 заново."

# Где лежит конфиг сайта: Debian/Ubuntu — sites-available, остальные — conf.d
conf_path() {
  if [ -d /etc/nginx/sites-available ]; then echo /etc/nginx/sites-available/autor.conf; else echo /etc/nginx/conf.d/autor.conf; fi
}

# Сайт — это index.html плюс папка assets/. Копируем всё, кроме служебных файлов,
# прошлый index.html оставляем рядом как index.prev.html.
publish_site() {
  install -d -m 755 "$ROOT"
  if [ -f "$ROOT/index.html" ]; then cp -p "$ROOT/index.html" "$ROOT/index.prev.html"; fi
  tar -C "$SRC" --exclude='server-setup.sh' --exclude='*.sh' -cf - . | tar -C "$ROOT" -xf -
  find "$ROOT" -type d -exec chmod 755 {} +
  find "$ROOT" -type f -exec chmod 644 {} +
}

# ---------- Обновление уже установленного сайта ----------
if [ -f "$ROOT/index.html" ] && [ -f "$(conf_path)" ]; then
  say "AutoR уже установлен — обновляю сайт"
  publish_site
  rm -rf "$SRC"
  ok "Новая версия на месте. Прошлая сохранена как $ROOT/index.prev.html"
  S=http; [ -d "/etc/letsencrypt/live/$DOMAIN" ] && S=https
  info "Откройте $S://$DOMAIN и обновите страницу (Ctrl+F5)."
  exit 0
fi

# ---------- 1. Что на сервере ----------
say "Проверка сервера"
. /etc/os-release 2>/dev/null || true
info "Система: ${PRETTY_NAME:-неизвестно}"
info "Свободно на диске: $(df -h / | awk 'NR==2{print $4}')"

PKG=""
if command -v apt-get >/dev/null 2>&1; then PKG=apt
elif command -v dnf >/dev/null 2>&1; then PKG=dnf
elif command -v yum >/dev/null 2>&1; then PKG=yum
fi
[ -n "$PKG" ] || die "Не нашёл apt, dnf или yum — эту систему скрипт не поддерживает. Пришлите мне вывод."

WEB80=$( { ss -ltnp 2>/dev/null || true; } | awk '$4 ~ /:80$/' | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | sort -u | tr '\n' ' ' | sed 's/ *$//' || true)
info "Порт 80 занят: ${WEB80:-свободен}"
if [ -n "$WEB80" ] && ! printf '%s' "$WEB80" | grep -qw nginx; then
  die "Порт 80 занимает не nginx ($WEB80) — похоже, там уже работает другой сайт или панель. Остановился, чтобы ничего не сломать. Пришлите мне этот вывод."
fi

if command -v nginx >/dev/null 2>&1; then
  info "nginx: установлен"
  OTHER=$(grep -RlsE "server_name[^;]*[[:space:]]$DOMAIN([[:space:];]|$)" /etc/nginx 2>/dev/null | grep -v '/autor.conf$' || true)
  [ -z "$OTHER" ] || die "Домен $DOMAIN уже настроен в другом конфиге nginx: $OTHER. Не трогаю — пришлите мне этот вывод."
  SITES=$( { ls /etc/nginx/sites-enabled 2>/dev/null; ls /etc/nginx/conf.d 2>/dev/null; } | grep -v '^default' | tr '\n' ' ' || true)
  info "Другие сайты в nginx: ${SITES:-нет}"
else
  info "nginx: не установлен — будет установлен"
fi

# Что сейчас открывается по этому домену
NOW=""
if command -v curl >/dev/null 2>&1; then
  NOW=$(curl -s --max-time 5 -H "Host: $DOMAIN" http://127.0.0.1/ 2>/dev/null | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' | head -c 80 || true)
fi
if [ -n "$NOW" ] && ! printf '%s' "$NOW" | grep -qi 'welcome to nginx'; then
  warn "По адресу $DOMAIN сейчас открывается сайт «$NOW». После установки вместо него будет AutoR."
fi

# Указывает ли домен на этот сервер
MYIPS=" $(hostname -I 2>/dev/null) "
DOMIP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)
NAMES="$DOMAIN"
HTTPS=1
if [ -z "$DOMIP" ]; then
  warn "Домен $DOMAIN не находится в DNS — HTTPS выпустить не получится, сайт будет только по http."; HTTPS=0
elif ! printf '%s' "$MYIPS" | grep -q " $DOMIP "; then
  # у некоторых хостингов внешний IP не виден в hostname -I — проверим по HTTP после установки
  info "Домен $DOMAIN указывает на $DOMIP"
else
  info "Домен $DOMAIN указывает на этот сервер ($DOMIP)"
fi
WWWIP=$(getent ahostsv4 "www.$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)
if [ -n "$WWWIP" ] && [ "$WWWIP" = "$DOMIP" ]; then NAMES="$DOMAIN www.$DOMAIN"; info "www.$DOMAIN тоже указывает сюда — добавлю"; fi

# ---------- 2. Подтверждение ----------
say "План"
info "Сайт: $NAMES  →  папка $ROOT"
info "Будет: установлен nginx (если его нет), добавлен отдельный конфиг autor.conf$( [ "$HTTPS" = 1 ] && echo ', выпущен бесплатный сертификат HTTPS (Let’s Encrypt)')"
info "Другие сайты и настройки сервера не трогаются."
printf '\n   Продолжить? [y/N] '
read -r ANS < /dev/tty || ANS=""
case "$ANS" in y|Y|yes|д|Д|да) ;; *) rm -rf "$SRC"; die "Отменено, на сервере ничего не изменено." ;; esac

# ---------- 3. nginx ----------
say "Установка"
if ! command -v nginx >/dev/null 2>&1; then
  if [ "$PKG" = apt ]; then
    DEBIAN_FRONTEND=noninteractive apt-get update -q >/dev/null
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q nginx >/dev/null
  else
    $PKG install -y nginx >/dev/null
  fi
  ok "nginx установлен"
fi
systemctl enable --now nginx >/dev/null 2>&1 || true

# Исходная конфигурация nginx должна быть рабочей — иначе не трогаем
if ! nginx -t >/dev/null 2>&1; then
  nginx -t || true
  rm -rf "$SRC"
  die "Конфигурация nginx на сервере уже с ошибкой (это не от AutoR). Ничего не менял — пришлите мне вывод выше."
fi

publish_site
ok "Сайт скопирован в $ROOT"

CONF=$(conf_path)
# IPv6 — только если nginx на сервере уже успешно его слушает
LISTEN6=""
if grep -RqsE '^[[:space:]]*listen[[:space:]]+\[::\]' /etc/nginx/nginx.conf /etc/nginx/sites-enabled /etc/nginx/conf.d; then LISTEN6="    listen [::]:80;"; fi
cat > "$CONF" <<EOF
# AutoR — сайт $DOMAIN (создано server-setup.sh)
server {
    listen 80;
$LISTEN6
    server_name $NAMES;
    root $ROOT;
    index index.html;
    charset utf-8;

    location / { try_files \$uri \$uri/ /index.html; }
    location ~ /\. { deny all; }
    location = /index.prev.html { deny all; }

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options SAMEORIGIN always;

    gzip on;
    gzip_types text/css application/javascript;
}
EOF
if [ -d /etc/nginx/sites-enabled ]; then ln -sf "$CONF" /etc/nginx/sites-enabled/autor.conf; fi

if ! nginx -t >/dev/null 2>&1; then
  nginx -t || true
  rm -f "$CONF" /etc/nginx/sites-enabled/autor.conf
  rm -rf "$SRC"
  die "Конфиг AutoR не прошёл проверку nginx — откатил свой файл, сервер работает как раньше. Пришлите мне вывод выше."
fi
systemctl reload nginx
ok "nginx настроен"

# ---------- 4. Файрвол: только открыть 80/443, если он уже включён ----------
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ok "В файрволе ufw открыты порты 80 и 443"
fi
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state 2>/dev/null | grep -q running; then
  firewall-cmd --permanent --add-service=http --add-service=https >/dev/null; firewall-cmd --reload >/dev/null
  ok "В firewalld открыты http и https"
fi

# ---------- 5. HTTPS ----------
SCHEME=http
if [ "$HTTPS" = 1 ]; then
  if ! command -v certbot >/dev/null 2>&1; then
    if [ "$PKG" = apt ]; then
      DEBIAN_FRONTEND=noninteractive apt-get install -y -q certbot python3-certbot-nginx >/dev/null || true
    else
      $PKG install -y certbot python3-certbot-nginx >/dev/null 2>&1 || true
    fi
  fi
  if command -v certbot >/dev/null 2>&1; then
    ARGS=(--nginx --non-interactive --agree-tos --redirect)
    for n in $NAMES; do ARGS+=(-d "$n"); done
    if [ -n "$EMAIL" ]; then ARGS+=(-m "$EMAIL"); else ARGS+=(--register-unsafely-without-email); fi
    if certbot "${ARGS[@]}" >/tmp/autor-certbot.log 2>&1; then
      ok "HTTPS включён, сертификат будет продлеваться сам"
      SCHEME=https
    else
      warn "Сертификат выпустить не удалось — сайт работает по http. Подробности: /tmp/autor-certbot.log"
      tail -5 /tmp/autor-certbot.log | sed 's/^/     /'
    fi
  else
    warn "Не удалось установить certbot — сайт работает по http."
  fi
fi

# ---------- 6. Проверка ----------
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: $DOMAIN" http://127.0.0.1/ 2>/dev/null || echo "?")
rm -rf "$SRC"
say "Готово"
info "Ответ сервера: $CODE (200 или 301 — всё в порядке)"
info "Откройте: $SCHEME://$DOMAIN"
