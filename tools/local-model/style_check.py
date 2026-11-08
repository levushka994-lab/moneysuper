#!/usr/bin/env python3
"""Стилевой линтер: ловит признаки ИИ-текста в ответах бота.

Портировано из blader/humanizer (MIT), адаптировано под русский чат магазина.
Смысл: модель должна звучать как менеджер, а не как ChatGPT. Линтер
детерминированный (regex), работает без модели и без сети.

Использование:
    python3 style_check.py answer.txt
    python3 style_check.py --jsonl dataset.jsonl [--field assistant]
"""
from __future__ import annotations

import argparse
import json
import re
import sys

# (id, описание, regex)
TELLS: list[tuple[str, str, str]] = [
    ("chatbot_open", "чатбот-обёртка", r"(?i)\b(отличн\w+ вопрос|хорош\w+ вопрос|конечно[,!.]|рад[а]? помочь|с удовольствием (помогу|расскажу))"),
    ("not_x_but_y", "«не просто X, а Y»", r"(?i)\bне просто\b[^.!?]{1,40}\bа\b"),
    ("lets_dive", "«давайте разберёмся»", r"(?i)давай(те)? (разбер|погруз|посмотр)"),
    ("modern_world", "«в современном мире»", r"(?i)(в современном мире|в наше время|на сегодняшний день|в эпоху)"),
    ("buzzword", "пустые усилители", r"(?i)(идеальн\w+ решени\w*|широк\w+ спектр|ключев\w+|неотъемлем\w*|комплексн\w+ подход|индивидуальн\w+ подход)"),
    ("emoji", "эмодзи", "[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B50\u2B06\u2B07]"),
    ("markdown", "markdown-разметка", r"(\*\*|__|`|^\s*[-*]\s+|^\s*#{1,6}\s|\[[^\]]+\]\([^)]+\))"),
    ("hope_helps", "«надеюсь, это поможет»", r"(?i)(надеюсь, (это|данная)|если (у вас )?остались вопросы|обращайтесь, если)"),
    ("important_note", "«важно отметить»", r"(?i)(важно отметить|стоит отметить|следует отметить)"),
    ("final_closer", "финальный однострочник", r"(?i)^(вот (так|и всё)|готово)[!.]?$"),
    ("passive", "пассив без агента", r"(?i)будет (произведён|произведен|выполнен|осуществлён|осуществлен|рассчитан)"),
    ("triad_adjectives", "триада прилагательных", r"(?i)\b(быстро|качественно|надёжно|надежно|профессионально|оперативно)\b[,\s]+(быстро|качественно|надёжно|надежно|профессионально|оперативно)[,\s]+и\b"),
    ("latin", "латиница (деградация)", r"[A-Za-z]{2,}"),
    ("chinese", "иероглифы (деградация)", r"[\u4e00-\u9fff]"),
]

COMPILED = [(tid, desc, re.compile(rx, re.MULTILINE)) for tid, desc, rx in TELLS]

# Мягкие признаки: не блокируют, но копятся в tells_count.
SOFT = [
    ("exclamation", re.compile(r"!")),
    ("em_dash_multi", re.compile(r"—.*—")),
]


def check(text: str) -> dict:
    """Вернуть {'tells': [id...], 'hard': n, 'soft': n, 'words': n}."""
    text = (text or "").strip()
    hard = [tid for tid, _desc, rx in COMPILED if rx.search(text)]
    soft = [tid for tid, rx in SOFT if rx.search(text)]
    return {
        "tells": hard,
        "hard": len(hard),
        "soft": soft,
        "words": len(text.split()),
    }


def is_clean(text: str, max_hard: int = 0) -> bool:
    return check(text)["hard"] <= max_hard


def main() -> int:
    ap = argparse.ArgumentParser(description="Признаки ИИ-текста в русском ответе")
    ap.add_argument("path", nargs="?", help="файл с текстом или .jsonl")
    ap.add_argument("--jsonl", action="store_true", help="читать jsonl, поле assistant/messages")
    ap.add_argument("--field", default="assistant", help="имя поля с ответом в jsonl")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if not args.path:
        text = sys.stdin.read()
        print(json.dumps(check(text), ensure_ascii=False, indent=2))
        return 0

    if args.jsonl:
        rows = [json.loads(line) for line in open(args.path, encoding="utf-8") if line.strip()]
        texts = []
        for r in rows:
            if args.field in r:
                texts.append(r[args.field])
            elif "messages" in r:
                texts.append(next((m["content"] for m in reversed(r["messages"]) if m["role"] == "assistant"), ""))
        stats = {"rows": len(texts), "with_tells": 0, "per_tell": {}}
        for t in texts:
            c = check(t)
            if c["hard"]:
                stats["with_tells"] += 1
            for tid in c["tells"]:
                stats["per_tell"][tid] = stats["per_tell"].get(tid, 0) + 1
        stats["rate"] = round(stats["with_tells"] / max(1, len(texts)), 4)
        print(json.dumps(stats, ensure_ascii=False, indent=2))
        return 0

    text = open(args.path, encoding="utf-8").read()
    print(json.dumps(check(text), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
