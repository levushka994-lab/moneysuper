#!/usr/bin/env python3
"""Генератор датасета для SFT: короткие ответы менеджера магазина «УЮТ-СТРОЙ».

Идея: все факты берутся из catalog.json, все суммы считаются кодом —
модель не может выучить неверную арифметику. Ответы пишутся в стиле
живого менеджера (см. style_check.py), без «Конечно!» и эмодзи.

Выход:
  dataset.jsonl   — train (system/user/assistant + meta)
  val.jsonl       — val
  heldout.jsonl   — 60 новых вопросов для честной проверки (без ответов)
"""
from __future__ import annotations

import itertools
import json
import random
import re
from pathlib import Path

HERE = Path(__file__).parent
CAT = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
ITEMS = {i["sku"]: i for i in CAT["items"]}
RNG = random.Random(20261108)
_CYCLE = itertools.count()

# ── компактный системный промпт (~90 токенов) ──────────────────────────────
def compact_prompt(cat: dict | None = None) -> str:
    cat = cat or CAT
    lines = [
        f"Ты — ассистент магазина «{cat['shop']['name']}» ({cat['shop']['city']}).",
        "Отвечай по-русски, коротко: 1–2 предложения, до 45 слов, без эмодзи и markdown.",
        "Говори только фактами из данных ниже. Если данных нет — предложи менеджера.",
        "Данные:",
    ]
    for it in cat["items"]:
        line = f"- {it['title']}: {it['price']} ₽/{it['unit']}"
        if it.get("min", 1) > 1:
            line += f", минимум {it['min']} {it['unit']}"
        if it.get("term"):
            line += f", срок {it['term']}"
        if it.get("stock") is not None:
            line += f", в наличии {it['stock']} {it['unit']}"
        lines.append(line)
    lines += [
        f"Доставка: {cat['delivery']}.",
        f"Оплата: {cat['payment']}.",
        f"Гарантия: {cat['warranty']}.",
    ]
    return "\n".join(lines)

SYSTEM = compact_prompt()

# ── тексты позиций ─────────────────────────────────────────────────────────
TXT = {
    "FAS-1450": dict(nom="утепление фасада", gen="утепления фасада", acc="фасад", prep="фасад", cap="Фасад"),
    "ROOF-1290": dict(nom="утепление кровли", gen="утепления кровли", acc="кровлю", prep="кровлю", cap="Кровля"),
    "BALC-44900": dict(nom="утепление балкона", gen="утепления балкона", acc="балкон", prep="балкон", cap="Балкон"),
    "PLUM-1500": dict(nom="вызов сантехника", gen="вызова сантехника", acc="сантехника", prep="сантехника", cap="Сантехник"),
    "MIX-1800": dict(nom="замена смесителя", gen="замены смесителя", acc="смеситель", prep="замену смесителя", cap="Смеситель"),
    "OSB-1490": dict(nom="плита ОСП-3", gen="плиты ОСП-3", acc="ОСП", prep="ОСП", cap="ОСП"),
    "WOOL-890": dict(nom="минвата Rockwool", gen="минваты Rockwool", acc="минвату", prep="минвату", cap="Минвата"),
}

AREAS = [35, 45, 50, 55, 60, 72, 80, 88, 92, 100, 110, 120, 140, 150, 160, 180, 200, 210]
HOLDOUT_AREAS = [75, 130, 210, 95, 165]

REPLIES = {
    "price_service_m2": [
        "{p} ₽ за {u}. Считаем по площади, минимум {m} {u}.",
        "{cap} — {p} ₽/{u} под ключ: материал, каркас и обшивка.",
        "{p} ₽ за {u} с работой и материалом. Замер бесплатный.",
        "Цена {p} ₽/{u}. Итог зависит от площади, посчитаю точно по вашим размерам.",
    ],
    "price_fixed": [
        "{cap} — {p} ₽ за {u}. Оплата после работы.",
        "{p} ₽ за {u}, выезд входит в стоимость.",
        "{p} ₽/{u}. Приедем в удобное время.",
    ],
    "price_good": [
        "{p} ₽ за {u}. На складе {st} {u}.",
        "{p} ₽/{u}, в наличии {st} {u}. Можем отложить.",
        "{p} ₽ за {u}. Есть сейчас, {st} {u}.",
    ],
    "term_outdoor": [
        "{cap} делаем за {t}. Срок зависит от площади и погоды.",
        "{t} на объект. Если дождь — сдвигаем на день-два, предупредим заранее.",
        "Работы займут {t}.",
    ],
    "term_indoor": [
        "{t}, если проводка и стены в порядке.",
        "Обычно {t}. Сразу после выезда скажем точнее.",
        "{t} на месте, без заказа деталей.",
    ],
    "min": [
        "Минимум {m} {u}. Меньше не берём: выезд и подготовка те же.",
        "От {m} {u}. На маленьком объёме цена за метр выше.",
        "Минимальный заказ — {m} {u}.",
    ],
    "start": [
        "Ближайшее окно — через 2–3 дня. Замер можем сделать завтра.",
        "Свободны через два дня. Замер бесплатный, приедем в удобное время.",
        "Можем начать на этой неделе. Сначала замер, потом точная смета.",
    ],
    "stock": [
        "Есть, {st} {u} по {p} ₽. Можем отложить до вечера.",
        "В наличии {st} {u}, {p} ₽ за {u}.",
        "{st} {u} на складе, цена {p} ₽.",
    ],
    "delivery": [
        "СДЭК — 390 ₽, 2–3 дня. Материалы возим по 35 ₽/км по области. Самовывоз бесплатный.",
        "Отправляем СДЭК за 390 ₽, доставка 2–3 дня. По МО материалы привезём за 35 ₽/км.",
        "Самовывоз бесплатный. СДЭК 390 ₽. Доставка материалов по области — 35 ₽/км.",
    ],
    "payment": [
        "Оплата картой, переводом или по счёту для юрлиц.",
        "Принимаем карту, перевод и безнал. Для юрлиц выставим счёт.",
        "Карта, перевод, счёт. Предоплату берём только на материалы.",
    ],
    "warranty": [
        "Гарантия 12 месяцев на работы. Талон и чек выдаём на месте.",
        "12 месяцев по договору. Если что-то пойдёт не так — приедем по гарантии.",
        "На работы даём 12 месяцев, документы прилагаем.",
    ],
    "discount": [
        "Скидок в прайсе нет. На объёме от 150 м² считаем индивидуально — уточню у менеджера.",
        "Фиксированной скидки нет. Если берёте два объекта, менеджер посмотрит по сумме.",
        "Цена уже с материалом. На больший объём можем пересчитать, но решает менеджер.",
    ],
    "greeting": [
        "Здравствуйте! Утепляем фасады и кровлю, выезжает сантехник, есть стройматериалы. Что нужно сделать?",
        "Добрый день. Фасады, кровля, балконы, сантехника и материалы. Скажите, что планируете?",
        "Здравствуйте! Подскажу по ценам, срокам и наличию. Что вас интересует?",
    ],
    "bot": [
        "Я ассистент магазина: отвечаю по прайсу, наличию и срокам. Менеджер подключится, если понадобится.",
        "Да, это автоматические ответы по каталогу. Сложные вопросы передаю живому менеджеру.",
        "Я помогаю с ценами и сроками. Если нужен человек — скажите, передам менеджеру.",
    ],
    "unknown": [
        "Такую услугу мы не делаем. Передам менеджеру — он подскажет, чем помочь.",
        "Этого нет в нашей работе. Уточню у менеджера, возможно, подскажет подрядчика.",
        "Мы такое не делаем, но менеджер знает больше — передам ему вопрос.",
    ],
    "geo": [
        "Работаем по Москве и области. Замер бесплатный.",
        "Москва и МО, выезжаем по области. Замер не берём отдельно.",
        "Да, ваш район в зоне выезда. Замер бесплатный.",
    ],
    "hours": [
        "Пн–Сб с 9 до 20. Заявки в чате принимаем круглосуточно.",
        "Работаем шесть дней в неделю, с 9 утра до 8 вечера. Пишите в любое время.",
        "С 9 до 20, кроме воскресенья. Отвечу и позже, если оставите сообщение.",
    ],
    "invoice": [
        "Да, работаем с юрлицами: счёт и закрывающие документы.",
        "Выставим счёт на организацию, оплата по безналу.",
        "С юрлицами работаем, документы даём полные.",
    ],
    "pickup": [
        "Самовывоз со склада бесплатный. Адрес пришлёт менеджер.",
        "Забрать можно со склада, бесплатно. Скажите, когда приедете.",
        "Самовывоз есть, склад в Москве. Забронируем ваш объём.",
    ],
    "volume": [
        "{a} м² по {p} ₽ — {total} ₽. {term}.",
        "На {a} м² выходит {total} ₽ по {p} ₽/{u}. {term}.",
        "{a} м² — это {total} ₽. {term}, замер бесплатный.",
        "{total} ₽ за {a} м². В цену входят материалы и работа.",
    ],
    "volume_below_min": [
        "Минимум {m} {u}. {a} м² не наберём — посчитаем как {m} м²: {total_min} ₽.",
        "Меньше {m} {u} не берём. За {a} м² всё равно будет {total_min} ₽.",
        "На {a} м² цена как за минимум {m} {u} — {total_min} ₽.",
    ],
    "bargain": [
        "Цена уже с материалом и работой. На {a} м² скидку не дам, но замер бесплатный.",
        "Торга в прайсе нет. Могу зафиксировать цену до конца недели.",
        "Скидку обсуждаю только на объёме от 150 м². Здесь цена окончательная.",
    ],
}


def money(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def add(pool: list, q: str, a: str, intent: str, sku: str | None = None, hard: bool = False) -> None:
    q = re.sub(r"\s+", " ", q).strip()
    a = re.sub(r"\s+", " ", a).strip()
    pool.append({"q": q, "a": a, "intent": intent, "sku": sku, "hard": hard})


def answer(kind: str, it: dict, txt: dict, *, area: int | None = None) -> str:
    variants = REPLIES[kind]
    t = variants[next(_CYCLE) % len(variants)]
    total = it["price"] * (area or 0)
    return t.format(
        p=it["price"], u=it["unit"], m=it.get("min", 1), t=it.get("term", ""), term=it.get("term", ""),
        cap=txt["cap"], a=area, total=money(total),
        total_min=money(it["price"] * it.get("min", 1)),
        st=it.get("stock", ""),
    )


def build() -> list[dict]:
    pool: list[dict] = []

    # 1. Цена — 7 позиций × 6 формулировок × 3 варианта ответа
    price_q = {
        "service_m2": ["Сколько стоит {nom}?", "Какая цена за {u}?", "Почём {nom}?",
                       "Сколько будет стоить {nom}?", "Назовите цену на {acc}.", "Цена за квадрат какая?"],
        "fixed": ["Сколько стоит {nom}?", "Какая цена на {prep}?", "Почём {nom}?",
                  "Сколько берёте за {nom}?", "Цена вопроса?", "Сколько это стоит?"],
        "good": ["Сколько стоит {nom}?", "Какая цена на {prep}?", "Почём {nom}?",
                 "Сколько за {nom}?", "Цена за {u}?", "Сколько выходит?"],
    }
    for sku, it in ITEMS.items():
        txt = TXT[sku]
        if it.get("stock") is not None:
            kind, qs = "good", price_q["good"]
        elif it.get("min", 1) > 1:
            kind, qs = "service_m2", price_q["service_m2"]
        else:
            kind, qs = "fixed", price_q["fixed"]
        for q in qs:
            qq = q.format(nom=txt["nom"], acc=txt["acc"], prep=txt.get("prep", txt["acc"]), u=it["unit"])
            for _ in range(3):
                add(pool, qq, answer(f"price_{kind}", it, txt), f"price:{sku}", sku)

    # 2. Объём: 2 позиции × площади × формулировки
    for sku in ("FAS-1450", "ROOF-1290"):
        it, txt = ITEMS[sku], TXT[sku]
        for area in AREAS:
            for q in (f"Нужно {area} квадратов. Сколько будет?",
                      f"Дом {area} м², посчитайте {txt['acc']}.",
                      f"{area} м² — какая сумма?"):
                add(pool, q, answer("volume", it, txt, area=area), f"volume:{sku}", sku)

    # 3. Минимум
    for sku in ("FAS-1450", "ROOF-1290"):
        it, txt = ITEMS[sku], TXT[sku]
        for q in (f"Какой минимальный объём по {txt['gen']}?",
                  f"Возьмёте {it['min'] - 8} квадратов?",
                  "Есть минимальный заказ?",
                  f"С какого объёма работаете по {txt['gen']}?"):
            add(pool, q, answer("min", it, txt), f"min:{sku}", sku)

    # 4. Сроки
    for sku, it in ITEMS.items():
        txt = TXT[sku]
        kind = "term_indoor" if sku in ("PLUM-1500", "MIX-1800") else "term_outdoor"
        for q in (f"Сколько времени займёт {txt['nom']}?",
                  f"Когда закончите {txt['acc']}?",
                  "Какие сроки?",
                  "Как быстро сделаете?"):
            add(pool, q, answer(kind, it, txt), f"term:{sku}", sku)

    # 5. Начало работ
    for sku in ("FAS-1450", "ROOF-1290"):
        it, txt = ITEMS[sku], TXT[sku]
        for q in ("Когда сможете начать?", "Как скоро приедете?",
                  "На этой неделе реально?", "Есть свободные дни?"):
            add(pool, q, answer("start", it, txt), f"start:{sku}", sku)

    # 6. Наличие товаров
    for sku in ("OSB-1490", "WOOL-890"):
        it, txt = ITEMS[sku], TXT[sku]
        for q in ("Есть в наличии?", "Сколько осталось?", "Можно забрать сегодня?",
                  "Товар есть на складе?", "Наличие какое?", "Привезёте завтра?"):
            add(pool, q, answer("stock", it, txt), f"stock:{sku}", sku)

    # 7. Глобальные темы
    global_q = {
        "delivery": ("Доставка", ["Доставка есть?", "Сколько стоит доставка?", "Как привезёте?",
                                  "Доставляете по области?", "Самовывоз возможен?", "Как быстро доставите?",
                                  "А доставка в Подольск?", "Сколько за доставку материалов?"]),
        "payment": ("Оплата", ["Как можно оплатить?", "Принимаете карту?", "Можно переводом?",
                               "Работаете по безналу?", "Оплата при получении?"]),
        "warranty": ("Гарантия", ["Какая гарантия?", "Гарантию даёте?", "Что с гарантией на работы?",
                                  "Сколько действует гарантия?", "Если брак — что делать?", "Договор даёте?"]),
        "discount": ("Скидка", ["Дадите скидку?", "Есть скидка на объём?", "Можно дешевле?",
                                "Торг возможен?", "Скиньте цену, возьму два объекта.", "10% скидки дадите?"]),
        "greeting": ("Приветствие", ["Привет!", "Здравствуйте!", "Добрый день!",
                                     "Здравствуйте, хочу уточнить пару вопросов.", "Приветствую!"]),
        "bot": ("Кто вы", ["Вы бот?", "С кем я общаюсь?", "Вы живой человек?",
                           "Это автоматический ответ?", "Вы робот?"]),
        "geo": ("География", ["Вы работаете в Подольске?", "Мой дом в Московской области, приедете?",
                              "Куда выезжаете?", "Работаете по области?", "А в Одинцово приедете?"]),
        "hours": ("Часы", ["Когда вы работаете?", "До скольки открыты?", "В выходные работаете?",
                           "Можно написать вечером?", "Во сколько отвечаете?"]),
        "invoice": ("Юрлица", ["Работаете с юрлицами?", "Можете выставить счёт?", "Нужны закрывающие документы.",
                               "Оплата от компании возможна?", "Договор с организацией?"]),
        "pickup": ("Самовывоз", ["Можно забрать самому?", "Где ваш склад?", "Самовывоз бесплатный?",
                                 "Когда можно приехать за товаром?", "Заберу сам, адрес?"]),
        "unknown": ("Нет услуги", ["Делаете натяжные потолки?", "А окна пластиковые ставите?",
                                   "Электрику можете провести?", "Кровлю из металлочерепицы делаете?",
                                   "Делаете ремонт под ключ?", "Стяжку пола делаете?",
                                   "А сайдинг? ", "Устанавливаете кондиционеры?",
                                   "Кладёте плитку?", "Можете фундамент залить?"]),
    }
    for key, (intent, qs) in global_q.items():
        for q in qs:
            add(pool, q, RNG.choice(REPLIES[key]), f"global:{key}")

    # 8. Комбинации: цена + срок
    for sku in ("FAS-1450", "ROOF-1290", "BALC-44900"):
        it, txt = ITEMS[sku], TXT[sku]
        for q in (f"Сколько стоит и сколько по времени {txt['nom']}?",
                  f"Цена и сроки по {txt['gen']}?",
                  f"Что по деньгам и срокам?"):
            a = f"{it['price']} ₽/{it['unit']}, срок {it.get('term','')}. Замер бесплатный."
            add(pool, q, a, f"combo:{sku}", sku)

    # 9. Догоняющие вопросы после сметы
    for sku in ("FAS-1450", "ROOF-1290"):
        it, txt = ITEMS[sku], TXT[sku]
        for area in (100, 120, 140, 160):
            for q in (f"А если {area} квадратов?", f"Пересчитайте на {area} м².",
                      f"У меня {area} м², что выйдет?"):
                add(pool, q, answer("volume", it, txt, area=area), f"followup:{sku}", sku)

    # 10. Торг по конкретной площади
    for sku in ("FAS-1450", "ROOF-1290"):
        it, txt = ITEMS[sku], TXT[sku]
        for area in (80, 92, 140):
            for q in (f"На {area} м² скидку дадите?", "Скиньте цену, возьму сейчас.",
                      f"За {area} квадратов дешевле можно?"):
                add(pool, q, answer("bargain", it, txt, area=area), f"bargain:{sku}", sku)

    # 11. Ниже минимума
    for sku in ("FAS-1450", "ROOF-1290"):
        it, txt = ITEMS[sku], TXT[sku]
        for area in (15, 20, 25):
            add(pool, f"Всего {area} м², посчитайте.", answer("volume_below_min", it, txt, area=area),
                f"below_min:{sku}", sku)

    # 12. «Сложные» кейсы: опечатки, спешка, два вопроса
    def typo(s: str) -> str:
        if len(s) < 12:
            return s
        i = RNG.randrange(4, len(s) - 4)
        op = RNG.choice(("del", "swap", "dup"))
        if op == "del":
            return s[:i] + s[i + 1:]
        if op == "swap":
            return s[:i] + s[i + 1] + s[i] + s[i + 2:]
        return s[:i] + s[i] + s[i:]

    base_pairs = [
        ("Сколько стоит утепление фасада?", "FAS-1450", "price_service_m2"),
        ("Какая цена на минвату?", "WOOL-890", "price_good"),
        ("Есть ли ОСП в наличии?", "OSB-1490", "stock"),
        ("Сколько стоит вызов сантехника?", "PLUM-1500", "price_fixed"),
        ("Когда сможете начать утепление кровли?", "ROOF-1290", "start"),
        ("Минимальный объём по фасаду?", "FAS-1450", "min"),
    ]
    for _ in range(120):
        q0, sku, kind = RNG.choice(base_pairs)
        it, txt = ITEMS[sku], TXT[sku]
        q = q0.format(nom=txt["nom"], acc=txt["acc"], prep=txt.get("prep", txt["acc"]), u=it["unit"]) if "{" in q0 else q0
        q = typo(q)
        if RNG.random() < 0.4:
            q = RNG.choice(("Срочно! ", "Извините, ", "Добрый день. ")) + q
        add(pool, q, answer(kind, it, txt), f"hard:{kind}", sku, hard=True)

    for _ in range(60):
        sku = RNG.choice(list(ITEMS))
        it, txt = ITEMS[sku], TXT[sku]
        q = RNG.choice((f"{txt['cap']} — цена? И сроки? И гарантия?",
                        f"Сколько стоит {txt['nom']}, есть в наличии и когда привезёте?",
                        f"Здравствуйте, нужен {txt['acc']}, сколько и как быстро?"))
        if it.get("stock") is not None:
            a = f"{it['price']} ₽ за {it['unit']}, в наличии {it['stock']}. Доставка СДЭК 390 ₽, 2–3 дня."
        elif it.get("min", 1) > 1:
            a = f"{it['price']} ₽/{it['unit']}, минимум {it['min']}. Срок {it.get('term','')}, гарантия 12 месяцев."
        else:
            a = f"{it['price']} ₽ за {it['unit']}. Гарантия 12 месяцев, приедем в день обращения."
        add(pool, q, a, "hard:multi", sku, hard=True)

    return pool


def dedupe(pool: list[dict]) -> list[dict]:
    seen, out = set(), []
    for r in pool:
        key = (r["q"].lower(), r["a"].lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


PREFIXES = ("Подскажите, ", "Здравствуйте! ", "Добрый день, ", "Извините, ")


def expand(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        out.append(r)
        q = r["q"]
        for pre in PREFIXES:
            if pre.endswith(", ") and q and q[0].isupper():
                out.append({**r, "q": pre + q[0].lower() + q[1:]})
            else:
                out.append({**r, "q": pre + q})
    return out


def base_of(q: str) -> str:
    for pre in PREFIXES:
        if q.startswith(pre):
            return q[len(pre):]
    return q


def main() -> None:
    pool = dedupe(expand(build()))
    groups: dict[str, list[dict]] = {}
    for r in pool:
        groups.setdefault(base_of(r["q"]).lower(), []).append(r)
    keys = list(groups)
    RNG.shuffle(keys)
    n_val = max(80, int(len(keys) * 0.14))
    val_keys = set(keys[:n_val])
    val = [r for k in val_keys for r in groups[k]]
    train = [r for k in keys if k not in val_keys for r in groups[k]]
    RNG.shuffle(train); RNG.shuffle(val)
    for path, rows in ((HERE / "dataset.jsonl", train), (HERE / "val.jsonl", val)):
        with path.open("w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps({
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": r["q"]},
                        {"role": "assistant", "content": r["a"]},
                    ],
                    "meta": {"intent": r["intent"], "sku": r["sku"], "hard": r["hard"]},
                }, ensure_ascii=False) + "\n")
    print(f"train {len(train)}  val {len(val)}  total {len(pool)}  hard {sum(r['hard'] for r in pool)}")


if __name__ == "__main__":
    main()
