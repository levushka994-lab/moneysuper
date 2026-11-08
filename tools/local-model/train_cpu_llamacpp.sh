#!/usr/bin/env bash
# LoRA на CPU через llama.cpp — медленный, но бесплатный путь для eta.
# Ночью: sudo systemd-run --on-calendar="*-*-* 03:00" --unit=autor-llm-train ./train_cpu_llamacpp.sh
set -euo pipefail
LLAMA="${LLAMA:-/opt/llama.cpp}"
DATA="${DATA:-dataset.jsonl}"
BASE="${BASE:-/var/lib/autor-llm/qwen2.5-1.5b-instruct-q4_0.gguf}"   # именно q4_0: финетьюн идёт на квантованной базе
OUT="${OUT:-/var/lib/autor-llm/lora-autor.gguf}"

[ -f "$DATA" ] || { echo "нет $DATA — сначала make_dataset.py" >&2; exit 1; }
[ -f "$BASE" ] || { echo "нет базовой модели $BASE" >&2; exit 1; }

# JSONL → plain text (llama-finetune читает txt)
python - "$DATA" > /tmp/autor-train.txt <<'PY'
import json, sys
for line in open(sys.argv[1], encoding="utf-8"):
    if not line.strip(): continue
    msgs = json.loads(line)["messages"]
    print("### " + msgs[0]["content"].replace("\n", " "))
    print(">>> " + msgs[1]["content"])
    print("<<< " + msgs[2]["content"])
    print()
PY

"$LLAMA/build/bin/llama-finetune" \
  -m "$BASE" -f /tmp/autor-train.txt --lora-out "$OUT" \
  --threads 10 --ctx-size 1024 --batch-size 8 \
  --lr 1e-4 --n-epochs 1 --adam-alpha 1e-4 --lora-r 16 --lora-alpha 32

ls -lh "$OUT"
echo "Готово. Подключается так: llama-server -m $BASE --lora $OUT ..."
