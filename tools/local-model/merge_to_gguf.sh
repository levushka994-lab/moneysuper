#!/usr/bin/env bash
# LoRA → HF → GGUF Q4_K_M для eta
set -euo pipefail
BASE="${BASE:-Qwen/Qwen2.5-1.5B-Instruct}"
ADAPTER="${1:?укажи папку с LoRA}"
OUT="${2:-autor-local-q4_k_m.gguf}"
LLAMA="${LLAMA:-/opt/llama.cpp}"

python - "$BASE" "$ADAPTER" <<'PY'
import sys, torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
base, adapter = sys.argv[1], sys.argv[2]
m = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.bfloat16)
m = PeftModel.from_pretrained(m, adapter).merge_and_unload()
m.save_pretrained("./merged", safe_serialization=True)
AutoTokenizer.from_pretrained(base).save_pretrained("./merged")
print("слито → ./merged")
PY

python "$LLAMA/convert_hf_to_gguf.py" ./merged --outtype f16 --outfile ./merged-f16.gguf
"$LLAMA/build/bin/llama-quantize" ./merged-f16.gguf "$OUT" Q4_K_M
ls -lh "$OUT"
