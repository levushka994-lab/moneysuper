#!/usr/bin/env python3
"""Оценка модели на golden.jsonl.

    python eval.py --endpoint http://127.0.0.1:8081/v1/chat/completions --model local
    python eval.py --endpoint https://autor.site-port.ru/api/chat --model deepseek-flash --key ...
"""
import argparse, json, os, re, statistics, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))

def default_prompt():
    """Тот же промпт с фактами, что уходит из кабинета: без фактов модель выдумывает цены."""
    cat = json.load(open(os.path.join(HERE, "catalog.json"), encoding="utf-8"))
    items = "; ".join(
        f"{i['title']} — {i['price']} ₽/{i['unit']}"
        + (f", минимум {i['min']} {i['unit']}" if i.get("min", 1) > 1 else "")
        + (f", срок {i['term']}" if i.get("term") else "")
        + (f", на складе {i['stock']} {i['unit']}" if i.get("stock") is not None else "")
        for i in cat["items"]
    )
    return (
        f"Ты — ассистент магазина «{cat['shop']['name']}» на Авито. Пиши по-русски, 1–2 предложения, "
        "без markdown и эмодзи. Факты бери только из данных ниже, ничего не выдумывай. "
        "Если факта нет — скажи, что уточнишь у менеджера. Скидку цифрой не называй. "
        "Считай стоимость по объёму: цена × количество.\n\n"
        f"Доставка: {cat['delivery']}. Оплата: {cat['payment']}. Гарантия: {cat['warranty']}. "
        f"Позиции: {items}."
    )

def call(endpoint, model, key, messages, max_tokens=120, timeout=30):
    body = json.dumps({"model": model, "messages": messages,
                       "max_tokens": max_tokens, "temperature": 0.0,
                       "thinking": {"type": "disabled"}}).encode()
    hdr = {"content-type": "application/json"}
    if key:
        hdr["authorization"] = f"Bearer {key}"
    req = urllib.request.Request(endpoint, data=body, headers=hdr)
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read())
    return data["choices"][0]["message"]["content"].strip(), time.time() - t0

def nums(text):
    """Числа из текста. Разряды через пробел/запятую/узкий пробел считаем одним числом:
    «145 000», «145,000», «145\u202f000» -> 145000."""
    t = (text or "").replace("\u202f", " ").replace("\u00a0", " ")
    t = re.sub(r"(?<=\d)[ ,](?=\d{3}\b)", "", t)
    return {n.strip() for n in re.findall(r"\d[\d ]{0,}", t) if n.strip()}

def catalog_numbers():
    """Всё, что вообще есть в каталоге: цены, остатки, сроки, минимумы, доставка."""
    cat = json.load(open(os.path.join(HERE, "catalog.json"), encoding="utf-8"))
    text = json.dumps(cat, ensure_ascii=False)
    extra = {str(v) for v in range(0, 101)}
    return nums(text) | extra

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", default="http://127.0.0.1:8081/v1/chat/completions")
    ap.add_argument("--model", default="local")
    ap.add_argument("--key", default=os.environ.get("DEEPSEEK_KEY", ""))
    ap.add_argument("--golden", default=os.path.join(HERE, "golden.jsonl"))
    ap.add_argument("--prompt", default="")
    ap.add_argument("--no-facts", action="store_true", help="без каталога в промпте (проверка «как галлюцинирует»)")
    ap.add_argument("--delay", type=float, default=0.0, help="пауза между запросами, сек")
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--json", default="")
    args = ap.parse_args()

    cases = [json.loads(l) for l in open(args.golden, encoding="utf-8") if l.strip()]
    system = args.prompt or ("Ты — ассистент магазина «УЮТ-СТРОЙ» на Авито. 1–2 предложения, без markdown."
                             if args.no_facts else default_prompt())
    ok_fact = ok_len = ok_esc = 0
    halluc = 0
    cat_nums = catalog_numbers()
    lats = []
    fails = []
    for c in cases:
        ans = dt = None
        for attempt in range(args.retries):
            try:
                ans, dt = call(args.endpoint, args.model, args.key,
                               [{"role": "system", "content": system},
                                {"role": "user", "content": c["q"]}])
                break
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt + 1 < args.retries:
                    time.sleep(2 + attempt * 2)
                    continue
                fails.append((c["id"], f"request failed: {e}"))
                break
            except Exception as e:
                fails.append((c["id"], f"request failed: {e}"))
                break
        if ans is None:
            continue
        if args.delay:
            time.sleep(args.delay)
        lats.append(dt)
        got = nums(ans)
        required = {str(n) for n in c.get("facts", [])}
        fact_ok = required.issubset(got) if required else True
        extra = got - required - cat_nums - nums(c["q"])
        halluc += bool(extra)
        len_ok = len(ans.split()) <= c.get("max_words", 45)
        esc = c.get("escalate")
        esc_ok = (esc is None) or (esc and re.search(r"менеджер|уточн|передам", ans, re.I)) or \
                 (not esc and not re.search(r"не делаем|не подходит", ans, re.I))
        ok_fact += bool(fact_ok)
        ok_len += bool(len_ok)
        ok_esc += bool(esc_ok)
        if not (fact_ok and len_ok and esc_ok) or extra:
            fails.append((c["id"], f"fact={fact_ok} len={len_ok} esc={esc_ok} extra={sorted(extra)} → {ans}"))

    n = len(cases)
    p95 = statistics.quantiles(lats, n=20)[-1] if len(lats) > 20 else (max(lats) if lats else 0)
    report = {
        "cases": n,
        "fact_accuracy": round(ok_fact / n, 3),
        "hallucinated": round(halluc / n, 3),
        "brevity": round(ok_len / n, 3),
        "escalation": round(ok_esc / n, 3),
        "latency_p50": round(statistics.median(lats), 2) if lats else None,
        "latency_p95": round(p95, 2) if lats else None,
    }
    print(json.dumps(report, ensure_ascii=False, indent=1))
    for cid, why in fails[:12]:
        print(f" - {cid}: {why}")
    if args.json:
        json.dump({"report": report, "fails": fails}, open(args.json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
    gates = (report["fact_accuracy"] >= 0.95 and report["hallucinated"] <= 0.01
             and report["brevity"] >= 0.9 and report["escalation"] >= 0.9)
    print("\nВОРОТА ПРИЁМКИ:", "ПРОЙДЕНЫ" if gates else "не пройдены")

if __name__ == "__main__":
    main()
