#!/usr/bin/env python3
"""AutoR — выдача и проверка промокодов.

Хранит только PBKDF2-хеши кодов (та же соль и 150 000 итераций, что в billing.js),
поэтому по файлу данных сами коды не восстановить.

Эндпоинты (JSON):
  POST /api/promo/issue   {"type":"access|vip|max","count":1}  -> {"codes":[...]}
  POST /api/promo/verify  {"code":"AUTOR-..."}                 -> {"valid":bool,"type":...,"msg":...}
  POST /api/promo/revoke  {"code":"AUTOR-..."}                 -> {"ok":bool}
  GET  /api/promo/list                                         -> {"codes":[{...}]}
  GET  /healthz                                                -> {"ok":true}

Админские ручки снаружи закрыты basic-auth на Caddy (листенер 8082);
на основном сайте опубликована только /api/promo/verify.
"""

import hashlib
import hmac
import json
import os
import random
import string
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DATA = os.environ.get("PROMO_DATA", "/srv/autor-codes/codes.json")
SALT = bytes.fromhex("139876865a93cdbd44b8c92a8e8211f1")
ITERATIONS = 150000
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
TYPES = ("access", "vip", "max")
LOCK = threading.Lock()
HITS = {}
HITS_LOCK = threading.Lock()


def normalize(raw):
    code = "".join(ch for ch in str(raw or "").upper() if ch.isalnum())
    for prefix in ("AUTOR", "AUT0R"):
        if code.startswith(prefix):
            code = code[len(prefix):]
            break
    return code if len(code) == 12 else ""


def hashed(code):
    return hashlib.pbkdf2_hmac("sha256", code.encode(), SALT, ITERATIONS).hex()


def grouped(code):
    return "AUTOR-" + "-".join(code[i:i + 4] for i in range(0, 12, 4))


def load():
    try:
        with open(DATA, encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"codes": []}


def save(data):
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    tmp = DATA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.chmod(tmp, 0o600)
    os.replace(tmp, DATA)


def too_many(ip):
    now = time.time()
    with HITS_LOCK:
        bucket = [t for t in HITS.get(ip, []) if now - t < 60]
        bucket.append(now)
        HITS[ip] = bucket
        return len(bucket) > 20


class Handler(BaseHTTPRequestHandler):
    server_version = "autor-promo"
    sys_version = ""

    def log_message(self, fmt, *args):
        pass

    def reply(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        try:
            size = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(size) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return {}

    def ip(self):
        return self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()

    def do_GET(self):
        if self.path == "/healthz":
            return self.reply({"ok": True})
        if self.path == "/api/promo/list":
            with LOCK:
                data = load()
            rows = [
                {
                    "code": item.get("code"),
                    "type": item.get("type"),
                    "created": item.get("created"),
                    "used": bool(item.get("used")),
                }
                for item in data["codes"]
            ]
            return self.reply({"codes": rows})
        return self.reply({"error": "not found"}, 404)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/promo/verify":
            if too_many(self.ip()):
                return self.reply({"valid": False, "msg": "Слишком много попыток, подождите минуту"}, 429)
            code = normalize(self.body().get("code"))
            if not code:
                return self.reply({"valid": False, "msg": "Код выглядит так: AUTOR-XXXX-XXXX-XXXX"})
            h = hashed(code)
            with LOCK:
                data = load()
                for item in data["codes"]:
                    if hmac.compare_digest(item["hash"], h):
                        if item.get("used"):
                            return self.reply({"valid": False, "msg": "Этот промокод уже активирован"})
                        if item.get("revoked"):
                            return self.reply({"valid": False, "msg": "Промокод отозван"})
                        item["used"] = int(time.time())
                        save(data)
                        return self.reply({"valid": True, "type": item["type"]})
            return self.reply({"valid": False, "msg": "Такого промокода нет. Проверьте, нет ли опечатки."})

        if path == "/api/promo/issue":
            body = self.body()
            kind = body.get("type") if body.get("type") in TYPES else "access"
            try:
                count = max(1, min(10, int(body.get("count", 1))))
            except (TypeError, ValueError):
                count = 1
            created = []
            with LOCK:
                data = load()
                for _ in range(count):
                    code = "".join(random.choice(ALPHABET) for _ in range(12))
                    row = {"code": grouped(code), "hash": hashed(code), "type": kind, "created": int(time.time()), "used": 0}
                    data["codes"].append(row)
                    created.append(row["code"])
                save(data)
            return self.reply({"codes": created, "type": kind})

        if path == "/api/promo/revoke":
            code = normalize(self.body().get("code"))
            h = hashed(code) if code else ""
            with LOCK:
                data = load()
                for item in data["codes"]:
                    if hmac.compare_digest(item["hash"], h):
                        item["revoked"] = 1
                        save(data)
                        return self.reply({"ok": True})
            return self.reply({"ok": False, "msg": "Не найдено"})

        return self.reply({"error": "not found"}, 404)


if __name__ == "__main__":
    port = int(os.environ.get("PROMO_PORT", "8098"))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
