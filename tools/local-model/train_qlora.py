#!/usr/bin/env python3
"""QLoRA для 1.5B/3B на одной GPU (24 GB хватает на 3B).

    pip install torch transformers peft datasets trl bitsandbytes accelerate
    python train_qlora.py --base Qwen/Qwen2.5-1.5B-Instruct --data dataset.jsonl --out lora-out

На CPU не запускать — используй train_cpu_llamacpp.sh.
"""
import argparse, json

def load(path):
    rows = []
    for line in open(path, encoding="utf-8"):
        if line.strip():
            rows.append(json.loads(line)["messages"])
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-1.5B-Instruct")
    ap.add_argument("--data", default="dataset.jsonl")
    ap.add_argument("--val", default="dataset.val.jsonl")
    ap.add_argument("--out", default="lora-out")
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--bs", type=int, default=1)
    ap.add_argument("--accum", type=int, default=8)
    ap.add_argument("--seq", type=int, default=1024)
    args = ap.parse_args()

    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import (AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig,
                              DataCollatorForLanguageModeling, Trainer, TrainingArguments)

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    def to_text(msgs):
        return tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)

    def prep(path):
        texts = [to_text(m) for m in load(path)]
        ds = Dataset.from_dict({"text": texts})
        return ds.map(lambda b: tok(b["text"], truncation=True, max_length=args.seq), batched=True)

    train_ds, val_ds = prep(args.data), prep(args.val)
    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                             bnb_4bit_compute_dtype=torch.bfloat16,
                             bnb_4bit_use_double_quant=True)
    model = AutoModelForCausalLM.from_pretrained(args.base, quantization_config=bnb,
                                                 device_map="auto")
    model = prepare_model_for_kbit_training(model)
    model = get_peft_model(model, LoraConfig(
        r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))

    targs = TrainingArguments(
        output_dir=args.out, num_train_epochs=args.epochs, learning_rate=args.lr,
        per_device_train_batch_size=args.bs, gradient_accumulation_steps=args.accum,
        gradient_checkpointing=True, logging_steps=25, save_strategy="epoch",
        eval_strategy="epoch", bf16=True, optim="paged_adamw_8bit", report_to="none",
    )
    Trainer(model=model, args=targs, train_dataset=train_ds, eval_dataset=val_ds,
            data_collator=DataCollatorForLanguageModeling(tok, mlm=False)).train()
    model.save_pretrained(args.out)
    tok.save_pretrained(args.out)
    print("готово →", args.out, "(дальше merge_to_gguf.sh)")

if __name__ == "__main__":
    main()
