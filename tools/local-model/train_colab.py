import os, subprocess, sys
os.chdir("/content/repo/tools/local-model")
subprocess.run([sys.executable,"-m","pip","-q","install","-U","transformers>=4.51","peft","datasets","accelerate"],check=False)
import json, re, time, statistics
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "taobao-mnn/MNN-Pocket-0.3B"
tok = AutoTokenizer.from_pretrained(MODEL)
tok.chat_template = open("chat_template.jinja", encoding="utf-8").read()
if tok.pad_token_id is None:
    tok.pad_token = tok.eos_token
model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float16, device_map="cuda")
model.eval()
print("params:", sum(p.numel() for p in model.parameters()) / 1e6, "M")


from prompts import build_system_prompt

SYS = build_system_prompt()
CASES = [json.loads(l) for l in open("golden.jsonl", encoding="utf-8")]

CAT_NUMS = set(range(101)) | {390, 35, 12, 150, 48}
for it in json.load(open("catalog.json", encoding="utf-8"))["items"]:
    CAT_NUMS |= {it["price"], it.get("min", 0), it.get("stock", 0)}


def nums(s):
    out = set()
    for m in re.findall(r"\d[\d\s\u202f]*", s):
        try:
            out.add(int(m.replace(" ", "").replace("\u202f", "")))
        except ValueError:
            pass
    return out


@torch.no_grad()
def gen(q, m, sysp=None, max_new=100):
    sysp = sysp or SYS
    msgs = [{"role": "system", "content": sysp}, {"role": "user", "content": q}]
    text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    enc = tok(text, return_tensors="pt").to(m.device)
    t0 = time.time()
    out = m.generate(**enc, max_new_tokens=max_new, do_sample=False, pad_token_id=tok.eos_token_id)
    dt = time.time() - t0
    ans = tok.decode(out[0][enc["input_ids"].shape[-1]:], skip_special_tokens=True).strip()
    return ans, dt


def evaluate(m, cases, tag, sysp=None):
    rows = []
    for c in cases:
        a, dt = gen(c["q"], m, sysp)
        got, req = nums(a), set(c["facts"])
        rows.append({
            "id": c["id"], "ans": a, "dt": dt,
            "fact": req <= got,
            "halluc": bool(got - req - nums(c["q"]) - CAT_NUMS),
            "esc": bool(re.search(r"менеджер|уточн|передам", a, re.I)) == bool(c.get("escalate")),
            "words": len(a.split()),
            "style": bool(re.search(r"(?i)(отличн\w+ вопрос|конечно[,!.]|рад[а]? помочь|не просто\b[^.!?]{1,40}\bа\b|давай(те)? (разбер|погруз)|важно отметить|надеюсь, (это|данная))", a)),
            "zh": bool(re.search(r"[\u4e00-\u9fff]", a)),
        })
    n = len(rows)
    res = {
        "tag": tag, "n": n,
        "fact": round(sum(r["fact"] for r in rows) / n, 3),
        "halluc": round(sum(r["halluc"] for r in rows) / n, 3),
        "brevity": round(sum(r["words"] <= 45 for r in rows) / n, 3),
        "escalation": round(sum(r["esc"] for r in rows) / n, 3),
        "style": round(sum(r["style"] for r in rows) / n, 3),
        "chinese": sum(r["zh"] for r in rows),
        "p50_s": round(statistics.median(r["dt"] for r in rows), 2),
    }
    print(json.dumps(res, ensure_ascii=False))
    return res, rows


BASE, BASE_ROWS = evaluate(model, CASES, "base")
for r in BASE_ROWS[:5]:
    print(r["id"], "|", r["ans"][:160])


from datasets import load_dataset

raw = load_dataset("json", data_files={"train": "dataset.jsonl", "validation": "val.jsonl"})


def prep(ex):
    msgs = ex["messages"]
    p = tok.apply_chat_template(msgs[:2], tokenize=False, add_generation_prompt=True)
    full = p + msgs[2]["content"] + tok.eos_token
    pids = tok(p, add_special_tokens=False)["input_ids"]
    ids = tok(full, add_special_tokens=False, truncation=True, max_length=640)["input_ids"]
    lab = list(ids)
    k = min(len(pids), len(lab))
    lab[:k] = [-100] * k
    return {"input_ids": ids, "labels": lab}


train_ds = raw["train"].map(prep, remove_columns=raw["train"].column_names)
val_ds = raw["validation"].map(prep, remove_columns=raw["validation"].column_names)
print(len(train_ds), len(val_ds), "max len", max(len(x) for x in train_ds["input_ids"]))


from peft import LoraConfig, get_peft_model
from transformers import Trainer, TrainingArguments

lora = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, lora)
model.print_trainable_parameters()


class Coll:
    def __init__(self, pad):
        self.pad = pad

    def __call__(self, feats):
        L = max(len(f["input_ids"]) for f in feats)
        return {
            "input_ids": torch.tensor([f["input_ids"] + [self.pad] * (L - len(f["input_ids"])) for f in feats]),
            "labels": torch.tensor([f["labels"] + [-100] * (L - len(f["labels"])) for f in feats]),
            "attention_mask": torch.tensor([[1] * len(f["input_ids"]) + [0] * (L - len(f["input_ids"])) for f in feats]),
        }


args = TrainingArguments(
    output_dir="/content/out",
    per_device_train_batch_size=8,
    gradient_accumulation_steps=2,
    num_train_epochs=2,
    learning_rate=2e-4,
    fp16=True,
    logging_steps=20,
    save_strategy="no",
    report_to="none",
    max_grad_norm=1.0,
)
trainer = Trainer(model=model, args=args, train_dataset=train_ds, data_collator=Coll(tok.pad_token_id))
t0 = time.time()
trainer.train()
print("train minutes:", round((time.time() - t0) / 60, 1))


model.eval()
TUNED, TUNED_ROWS = evaluate(model, CASES, "tuned")
for r in TUNED_ROWS[:5]:
    print(r["id"], "|", r["ans"][:160])

summary = {"base": BASE, "tuned": TUNED, "train_min": round((time.time() - t0) / 60, 1)}
print("RESULT_JSON=" + json.dumps(summary, ensure_ascii=False))


model.save_pretrained("/content/adapter")
tok.save_pretrained("/content/adapter")
!cd /content && zip -qr adapter.zip adapter && du -h adapter.zip
print('adapter ready at /content/adapter.zip')

