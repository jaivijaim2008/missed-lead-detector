"""
test_llm_before_after.py
------------------------
Before/after comparison of the OLD TF-IDF classifier vs the NEW LLM
classifier, run against the real inbox emails currently in the database
(only real Gmail rows — message_id IS NOT NULL — are used; simulated
rows are skipped).

Nothing is written to the database: both classifications happen in memory.

Usage (from project root):
    export GEMINI_API_KEY=...   (or ANTHROPIC_API_KEY / OPENAI_API_KEY)
    python test_llm_before_after.py              # all real emails
    python test_llm_before_after.py --limit 60   # only currently-mislabeled rows
    python test_llm_before_after.py --senders devpost,kaggle,facebook,ollama
"""

import os
import sys
import time
import sqlite3
import argparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")
for p in (APP_DIR, BASE_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

from database import DB_PATH  # noqa: E402
from llm_classifier import (  # noqa: E402
    classify_email_llm,
    get_model_name,
    get_provider_label,
)
from process_email import _classify_with_fallback  # noqa: E402

# Ground truth by sender: these senders are automated / notification mail.
# Anything from them should end up "normal" or "spam", never "lead".
AUTOMATED_SENDER_KEYWORDS = [
    "devpost", "kaggle", "facebook", "reddit", "ollama", "spotify",
    "adobe", "vercel", "elevenlabs", "youtube", "groq", "razorpay",
    "cloudflare", "brevo", "hotmart", "openai.com", "googleaistudio",
    "handshake", "takeuforward", "nexusmods", "podsqueeze", "descript",
    "slack", "salesforce", "apacemarketing",
]


def is_automated(sender: str) -> bool:
    s = (sender or "").lower()
    return any(k in s for k in AUTOMATED_SENDER_KEYWORDS)


def main():
    # Windows consoles default to cp1252; subject lines contain emoji/₹ etc.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None,
                        help="Only classify the first N rows (default: all real emails)")
    parser.add_argument("--senders", type=str, default=None,
                        help="Comma-separated sender substrings to filter on")
    parser.add_argument("--only-leads", action="store_true",
                        help="Only rows the old model labeled 'lead'")
    parser.add_argument("--delay", type=float, default=13.0,
                        help="Seconds between API calls (default 13.0 to stay under Groq free-tier 8k TPM)")
    args = parser.parse_args()

    if not get_provider_label():
        print("ERROR: no LLM API key found. Set one of:\n"
              "  GEMINI_API_KEY     (free tier, no credit card)\n"
              "  ANTHROPIC_API_KEY\n"
              "  OPENAI_API_KEY")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, sender, subject, body, label
        FROM emails
        WHERE message_id IS NOT NULL AND message_id != ''
        ORDER BY id
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if args.senders:
        keys = [k.strip().lower() for k in args.senders.split(",") if k.strip()]
        rows = [r for r in rows if any(k in (r["sender"] or "").lower() for k in keys)]
    if args.only_leads:
        rows = [r for r in rows if r["label"] == "lead"]
    if args.limit:
        rows = rows[: args.limit]

    print("=" * 72)
    print(f"BEFORE/AFTER — old TF-IDF label vs new LLM "
          f"({get_provider_label()} / {get_model_name()})")
    print(f"Rows to classify: {len(rows)} (real Gmail emails from the DB)")
    print("=" * 72)

    stats = {
        "total": len(rows),
        "before_lead": 0,
        "after_lead": 0,
        "fixed": 0,        # old=lead and clearly-automated -> after normal/spam
        "still_lead": 0,   # old=lead, automated, but LLM still says lead
        "regressions": 0,  # old!=lead but LLM says lead
        "llm_failed": 0,
    }
    regression_rows = []
    still_lead_rows = []

    for i, row in enumerate(rows, 1):
        sender = row["sender"] or ""
        subject = row["subject"] or ""
        text = f"{subject} {row['body'] or ''}"

        old_label = row["label"]  # what the TF-IDF model stored in the DB
        fb_prediction, _conf, _intent, _prio = _classify_with_fallback(text)

        llm = None
        for attempt in range(3):  # extra retries for free-tier 429s
            llm = classify_email_llm(sender, subject, row["body"] or "")
            if llm is not None:
                break
            if attempt < 2:
                time.sleep(20)
        if llm is None:
            stats["llm_failed"] += 1
            print(f"  [{i}/{len(rows)}] id={row['id']} LLM FAILED (API error?) — skipped")
            continue
        new_label = llm["label"]
        time.sleep(args.delay)

        if old_label == "lead":
            stats["before_lead"] += 1
        if new_label == "lead":
            stats["after_lead"] += 1

        automated = is_automated(sender)
        if automated and old_label == "lead" and new_label in ("normal", "spam"):
            stats["fixed"] += 1
            print(f"  [{i}/{len(rows)}] id={row['id']} FIXED   {sender[:34]:<34} "
                  f"lead -> {new_label}  | {subject[:44]}")
        elif automated and old_label == "lead" and new_label == "lead":
            stats["still_lead"] += 1
            still_lead_rows.append((row["id"], sender, subject, llm["reasoning"]))
            print(f"  [{i}/{len(rows)}] id={row['id']} MISSED? {sender[:34]:<34} "
                  f"lead -> lead  | {subject[:44]}")
        elif not automated and old_label != "lead" and new_label == "lead":
            stats["regressions"] += 1
            regression_rows.append((row["id"], sender, subject, llm["reasoning"]))
            print(f"  [{i}/{len(rows)}] id={row['id']} NEW LEAD {sender[:34]:<34} "
                  f"{old_label} -> lead | {subject[:44]}")

    print()
    print("=" * 72)
    print("SUMMARY")
    print("=" * 72)
    print(f"  Emails compared:                 {stats['total']}")
    print(f"  LLM call failures:               {stats['llm_failed']}")
    print(f"  'lead' count  BEFORE (TF-IDF):   {stats['before_lead']}")
    print(f"  'lead' count  AFTER  (LLM):      {stats['after_lead']}")
    print(f"  Misclassified auto-mails fixed:  {stats['fixed']}")
    print(f"  Auto-mails still marked lead:    {stats['still_lead']}")
    print(f"  Possible regressions (new leads from human-looking senders): {stats['regressions']}")
    print()

    if still_lead_rows:
        print("Auto-mail senders the LLM still calls 'lead' (review these):")
        for rid, sender, subject, reasoning in still_lead_rows:
            print(f"  id={rid}  {sender[:40]}  |  {subject[:60]}")
            print(f"          reason: {reasoning}")
        print()

    if regression_rows:
        print("NEW leads found by the LLM that TF-IDF missed (should be real inquiries):")
        for rid, sender, subject, reasoning in regression_rows:
            print(f"  id={rid}  {sender[:40]}  |  {subject[:60]}")
            print(f"          reason: {reasoning}")
        print()

    print("NOTE: nothing was written to the database — labels in leads.db are unchanged.")
    print("To apply the new labels permanently, re-sync from Gmail in the dashboard")
    print("(Settings -> 'Check my Gmail now') so every email is reprocessed by the LLM.")


if __name__ == "__main__":
    main()
