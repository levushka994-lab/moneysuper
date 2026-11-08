#!/usr/bin/env bash
# Поднимает llama-server на eta как systemd-сервис и открывает /api/local-chat через Caddy.
set -euo pipefail
BIN="${BIN:-/opt/llama.cpp/build/bin/llama-server}"
MODEL="${MODEL:-/var/lib/autor-llm/qwen2.5-1.5b-instruct-q4_k_m.gguf}"
PORT="${PORT:-8081}"
LORA="${LORA:-}"   # /var/lib/autor-llm/lora-autor.gguf
[ -x "$BIN" ] || { echo "нет $BIN — соберите llama.cpp" >&2; exit 1; }
[ -f "$MODEL" ] || { echo "нет модели $MODEL" >&2; exit 1; }

lora_arg=""
[ -n "$LORA" ] && [ -f "$LORA" ] && lora_arg="--lora $LORA"

doas tee /etc/systemd/system/autor-llm.service >/dev/null <<UNIT
[Unit]
Description=AutoR local LLM (llama.cpp)
After=network-online.target

[Service]
User=eta
ExecStart=$BIN -m $MODEL $lora_arg --host 127.0.0.1 --port $PORT \
  -c 4096 -np 2 -t 8 --no-mmap --chat-template chatml
Restart=always
RestartSec=5
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/autor-llm
MemoryMax=6G
CPUQuota=900%

[Install]
WantedBy=multi-user.target
UNIT

doas systemctl daemon-reload
doas systemctl enable --now autor-llm.service
sleep 2
curl -s "http://127.0.0.1:$PORT/v1/models" && echo
echo "Сервис поднят. Дальше — маршрут в Caddyfile: handle /api/local-chat* { reverse_proxy 127.0.0.1:$PORT }"
