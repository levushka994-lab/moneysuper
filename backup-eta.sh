#!/usr/bin/env bash
# Резервная копия того, что живёт только на eta: конфиги, секреты, выложенный сайт.
set -euo pipefail
DEST="${BACKUP_DIR:-/var/backups/autor}"
KEEP="${KEEP:-14}"
STAMP=$(date +%F-%H%M)
mkdir -p "$DEST"

FILES=()
for p in /etc/caddy /etc/autor /etc/systemd/system/autor-tunnel.service \
         /etc/systemd/system/autor-eta-sync.service /etc/systemd/system/autor-eta-sync.timer \
         /etc/systemd/system/autor-guard.service /etc/autor/autor-guard.nft \
         /etc/ssh/sshd_config.d/10-autor-hardening.conf \
         /srv/site-port/sites/autor.site-port.ru /home/eta/.cloudpub.env; do
  [ -e "$p" ] && FILES+=("$p")
done

tar -czf "$DEST/autor-$STAMP.tar.gz" --absolute-names "${FILES[@]}" 2>/dev/null || \
  tar -czf "$DEST/autor-$STAMP.tar.gz" "${FILES[@]}"

chmod 600 "$DEST/autor-$STAMP.tar.gz"
ls -1t "$DEST"/autor-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "[$(date '+%F %T')] бэкап $DEST/autor-$STAMP.tar.gz ($(du -h "$DEST/autor-$STAMP.tar.gz" | cut -f1))"
