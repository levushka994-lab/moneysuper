"""Общий промпт с фактами каталога: один и тот же текст в обучении и в оценке.

До правки этот текст был продублирован в eval.py и make_dataset.py с мелкими
отличиями — модель училась на одном промпте, а проверялась на другом.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def load_catalog(path=None):
    with open(path or os.path.join(HERE, "catalog.json"), encoding="utf-8") as f:
        return json.load(f)


def facts_line(cat):
    items = "; ".join(
        f"{i['title']} — {i['price']} ₽/{i['unit']}"
        + (f", минимум {i['min']} {i['unit']}" if i.get("min", 1) > 1 else "")
        + (f", срок {i['term']}" if i.get("term") else "")
        + (f", на складе {i['stock']} {i['unit']}" if i.get("stock") is not None else "")
        for i in cat["items"]
    )
    return (
        f"Доставка: {cat['delivery']}. Оплата: {cat['payment']}. Гарантия: {cat['warranty']}. "
        f"Позиции: {items}."
    )


def build_system_prompt(cat=None):
    """Ровно тот промпт, который уходит из кабинета AutoR."""
    cat = cat or load_catalog()
    return (
        f"Ты — ассистент магазина «{cat['shop']['name']}» на Авито. Пиши по-русски, 1–2 предложения, "
        "без markdown и эмодзи. Факты бери только из данных ниже, ничего не выдумывай. "
        "Если факта нет — скажи, что уточнишь у менеджера. Скидку цифрой не называй. "
        "Считай стоимость по объёму: цена × количество.\n\n"
        + facts_line(cat)
    )
