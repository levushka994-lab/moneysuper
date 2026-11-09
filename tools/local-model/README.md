# tools/local-model — локальная модель на eta

Что здесь лежит:

| файл | зачем |
|---|---|
| `REPORT.md` | **отчёт с замерами: 0.3B против Qwen 1.5B, вывод про дообучение** |
| `PLAN.md` | план: данные → обучение → оценка → подключение |
| `gen_dataset.py` | генератор SFT-пар из каталога (без внешних данных) |
| `style_check.py` | линтер ИИ-стиля: 14 признаков, порт blader/humanizer |
| `train_colab.py` | обучение на Colab T4 через официальный Colab CLI |
| `catalog.json` | факты демо-каталога для генерации диалогов и проверки чисел |
| `make_dataset.py` | генерирует SFT-датасет (JSONL) через DeepSeek-учителя |
| `golden.jsonl` | набор оценочных вопросов с ожидаемыми цифрами |
| `eval.py` | метрики: факты, выдумки, длина, эскалация, judge |
| `train_qlora.py` | QLoRA-обучение 1.5B/3B на GPU |
| `train_cpu_llamacpp.sh` | тот же LoRA, но на CPU через llama.cpp (для eta) |
| `serve-llama.sh` | запуск `llama-server` на eta и маршрут Caddy |

## Быстрый старт на eta

```bash
# 1. Python 3.12 и llama.cpp
doas pacman -S --needed cmake git python
curl -LsSf https://astral.sh/uv/install.sh | sh && uv python install 3.12
git clone https://github.com/ggml-org/llama.cpp /opt/llama.cpp
cmake -S /opt/llama.cpp -B /opt/llama.cpp/build -DGGML_NATIVE=ON -DLLAMA_CURL=OFF
cmake --build /opt/llama.cpp/build -j12 --target llama-server llama-quantize llama-cli

# 2. базовая модель
mkdir -p /var/lib/autor-llm && cd /var/lib/autor-llm
curl -LO https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf

# 3. поднять как сервис (см. serve-llama.sh)
doas ./serve-llama.sh
```

## Проверка

```bash
curl -s http://127.0.0.1:8081/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"local","messages":[{"role":"user","content":"Сколько стоит утепление фасада за м²?"}],"max_tokens":80}'
```
