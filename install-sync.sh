#!/usr/bin/env bash
#
# AutoR — установка автовыкладки на сервере (запускать от root).
#
#   bash install-sync.sh
#
# Ставит /usr/local/bin/autor-sync и systemd-таймер, который раз в минуту
# проверяет ветку main на GitHub и выкладывает свежий index.html в /var/www/autor.
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запускать от root: sudo bash install-sync.sh" >&2
  exit 1
fi

HERE=$(cd "$(dirname "$0")" && pwd)
REPO_URL="${AUTOR_REPO_URL:-https://github.com/levushka994-lab/moneysuper.git}"
BRANCH="${AUTOR_BRANCH:-main}"

echo "== AutoR: автовыкладка =="
echo "   репозиторий: $REPO_URL ($BRANCH)"

command -v git >/dev/null || { echo "Нет git: apt-get install -y git" >&2; exit 1; }

install -m 755 "$HERE/sync-deploy.sh" /usr/local/bin/autor-sync
mkdir -p /opt/autor /etc/autor

cat > /etc/autor/sync.env <<EOF
# Настройки автовыкладки AutoR (подхватываются systemd-сервисом).
AUTOR_REPO_URL=$REPO_URL
AUTOR_BRANCH=$BRANCH
# Для приватного репозитория впишите адрес с токеном:
# AUTOR_REPO_URL=https://<token>@github.com/owner/repo.git
EOF
chmod 644 /etc/autor/sync.env

cat > /etc/systemd/system/autor-sync.service <<'EOF'
[Unit]
Description=AutoR: забрать свежий билд с GitHub и выложить
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=-/etc/autor/sync.env
ExecStart=/usr/local/bin/autor-sync
StandardOutput=append:/var/log/autor-sync.log
StandardError=append:/var/log/autor-sync.log
TimeoutStartSec=180
EOF

cat > /etc/systemd/system/autor-sync.timer <<'EOF'
[Unit]
Description=AutoR: проверка обновлений раз в минуту

[Timer]
OnBootSec=30s
OnUnitActiveSec=60s
AccuracySec=5s
Unit=autor-sync.service

[Install]
WantedBy=timers.target
EOF

cat > /etc/logrotate.d/autor-sync <<'EOF'
/var/log/autor-sync.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF

touch /var/log/autor-sync.log
chmod 644 /var/log/autor-sync.log

systemctl daemon-reload
systemctl enable --now autor-sync.timer

echo "   сервис установлен, первый прогон..."
systemctl start autor-sync.service || true
sleep 2

echo
echo "== Проверка =="
systemctl --no-pager --lines=0 status autor-sync.timer | head -4 || true
echo
echo "Лог (последние строки):"
tail -5 /var/log/autor-sync.log 2>/dev/null || echo "  (пока пусто)"
echo
echo "Дальше: любая правка index.html в ветке $BRANCH, git push — сайт обновится в течение минуты."
echo "Проверить руками: systemctl start autor-sync.service; tail -f /var/log/autor-sync.log"
