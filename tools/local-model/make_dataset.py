#!/usr/bin/env python3
"""Генерирует SFT-датасет для локальной модели AutoR.

Учитель — любая OpenAI-совместимая модель (по умолчанию DeepSeek через /api/chat).
Без ключа работает оффлайн: ответы собираются по шаблону из catalog.json.
Использование:
    python make_dataset.py --out dataset.jsonl [--offline] [--limit 3000]
"""
import argparse, json, os, random, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG = json.load(open(os.path.join(HERE, "catalog.json"), encoding="utf-8"))

SYSTEM = (
    "Ты — ассистент магазина «{shop}» на Авито. Отвечаешь покупателю вместо продавца. "
    "Пиши по-русски, 1–2 предложения, без списков, markdown и эмодзи. "
    "Факты бери только из данных ниже, ничего не выдумывай. "
    "Если факта нет — скажи, что уточнишь у менеджера, и передай диалог. "
    "Скидку цифрой не называй. Считай стоимость по объёму: цена × количество."
)

PHONE = ["Ой, извините, а по телефону можно?", "Скиньте номер, перезвоню"]

QUESTIONS = {
    "avail": ["{item} есть в наличии?", "Здравствуйте! {item} ещё остался?", "Есть {item}?"],
    "price": ["Сколько стоит {item}?", "{item} — какая цена?", "Почём {item} у вас?"],
    "volume": ["Нужно {n} {unit} — сколько будет?", "Если {n} {unit}, какая сумма?", "{n} {unit} {item} — посчитайте"],
    "term": ["Когда сможете приехать?", "Какие сроки на {item}?", "Когда начнёте работы?"],
    "delivery": ["А доставка сколько стоит?", "Как быстро доставите в Подольск?", "Самовывоз есть?"],
    "discount": ["Скидку сделаете?", "А дешевле можно?", "Торг возможен?"],
    "unknown": ["А бассейн построите?", "У вас есть снегоуборка?", "Дом под ключ делаете?"],
}

def esc(s):
    return re.sub(r"\s+", " ", s).strip()

def facts_block():
    items = "; ".join(
        f"{i['title']} — {i['price']} ₽/{i['unit']}"
        + (f", минимум {i['min']} {i['unit']}" if i.get("min", 1) > 1 else "")
        + (f", срок {i['term']}" if i.get("term") else "")
        + (f", на складе {i['stock']} {i['unit']}" if i.get("stock") is not None else "")
        for i in CATALOG["items"]
    )
    return (
        f"Магазин: {CATALOG['shop']['name']}, {CATALOG['shop']['city']}. "
        f"Доставка: {CATALOG['delivery']}. Оплата: {CATALOG['payment']}. Гарантия: {CATALOG['warranty']}. "
        f"Позиции: {items}."
    )

def offline_answer(kind, item, n):
    price = item["price"] if item else 0
    if kind == "avail":
        if item.get("stock") is None:
            return f"{item['title']} делаем под заказ, ближайшее окно уточню у мастера.", None
        return f"{item['title']} есть, осталось {item['stock']} {item['unit']} по {price} ₽.", None
    if kind == "price":
        extra = f", минимум {item['min']} {item['unit']}" if item.get("min", 1) > 1 else ""
        return f"{item['title']} — {price} ₽ за {item['unit']}{extra}.", None
    if kind == "volume":
        total = round(price * n)
        return f"{n} {item['unit']} по {price} ₽ — это {total} ₽. Замер бесплатный.", total
    if kind == "term":
        return f"Ближайшее окно — {item.get('term', 'завтра')}. Скажите адрес, подтвержу время.", None
    if kind == "delivery":
        return "СДЭК 2–3 дня — 390 ₽, по МО материалы 35 ₽/км, самовывоз бесплатный.", None
    if kind == "discount":
        return "Скидку подтвердит менеджер — передаю ему диалог, он вернётся с расчётом.", None
    return "Такую услугу мы не делаем — уточню у менеджера, он подскажет варианты.", None

def ask_teacher(messages, endpoint, key, model):
    body = json.dumps({
        "model": model,
        "messages": messages,
        "max_tokens": 160,
        "temperature": 0.8,
        "thinking": {"type": "disabled"},
    }).encode()
    req = urllib.request.Request(endpoint, data=body, headers={
        "content-type": "application/json", "authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=40) as r:
        data = json.loads(r.read())
    return esc(data["choices"][0]["message"]["content"])

def numbers(text):
    return set(re.findall(r"\d[\d\s]{1,}", text.replace("\u00a0", " ")))

def looks_ok(answer, allowed):
    if not answer or len(answer.split()) > 45:
        return False
    return all(any(ch.isdigit() for ch in n) and n.replace(" ", "") in allowed for n in numbers(answer))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="dataset.jsonl")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--limit", type=int, default=3000)
    ap.add_argument("--endpoint", default=os.environ.get("AUTOR_ENDPOINT", "https://site-port.ru/api/chat"))
    ap.add_argument("--key", default=os.environ.get("DEEPSEEK_KEY", ""))
    ap.add_argument("--model", default=os.environ.get("AUTOR_MODEL", "deepseek-flash"))
    args = ap.parse_args()

    system = SYSTEM.format(shop=CATALOG["shop"]["name"]) + "\n\n" + facts_block()
    rnd = random.Random(42)
    rows = []
    items = CATALOG["items"]
    plan = []
    for kind, templates in QUESTIONS.items():
        for item in items:
            for t in templates:
                for _ in range(2):
                    plan.append((kind, item, t))
    rnd.shuffle(plan)

    for kind, item, tmpl in plan:
        if len(rows) >= args.limit:
            break
        if kind == "unknown":
            item = rnd.choice(items)
        n = rnd.choice([30, 40, 60, 90, 100, 120, 140])
        q = tmpl.format(item=item["title"], n=n, unit=item["unit"])
        allowed = {str(item["price"]), str(item.get("stock", "")), str(n), str(round(item["price"] * n))}
        allowed = {a for a in allowed if a}
        if args.offline:
            ans, total = offline_answer(kind, item, n)
        else:
            try:
                ans = ask_teacher([
                    {"role": "system", "content": system},
                    {"role": "user", "content": q},
                ], args.endpoint, args.key, args.model)
            except Exception as e:
                print("teacher failed:", e, file=sys.stderr)
                continue
        if not looks_ok(ans, allowed):
            continue
        rows.append({"messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": q},
            {"role": "assistant", "content": ans},
        ]})
        if len(rows) % 100 == 0:
            print(f"\r{len(rows)} пар", end="", file=sys.stderr)

    rnd.shuffle(rows)
    n_val = max(1, len(rows) // 20)
    with open(args.out.replace(".jsonl", ".val.jsonl"), "w", encoding="utf-8") as f:
        for r in rows[:n_val]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(args.out, "w", encoding="utf-8") as f:
        for r in rows[n_val:]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\nготово: {len(rows) - n_val} train / {n_val} val → {args.out}")

if __name__ == "__main__":
    main()
