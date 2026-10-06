"""
relabel_existing_emails.py
--------------------------
Re-runs classification on emails ALREADY STORED in leads.db and updates
their labels in place. The Groq LLM classifier only ran on new incoming
mail after it was introduced — the rows already sitting in the DB kept
their OLD TF-IDF labels. This script fixes that retroactively.

Same LLM, same prompt, same confidence/intent/priority mapping as
process_email.process_email() — this just applies it to existing rows.

Rate-limit friendly (Groq free tier: ~8k TPM, 200k TPD rolling window):
  - 13s sleep between calls (same tuning as test_llm_before_after.py)
  - classify_email_llm() internally retries 429s with server-provided hints
  - on daily-quota (TPD) exhaustion the script sleeps for the server-advised
    window (up to MAX_BACKOFF_S) and continues — no rows are skipped
  - a final retry pass re-runs any rows that still failed

Usage (from project root):
    python relabel_existing_emails.py                 # all real emails
    python relabel_existing_emails.py --only-leads    # only label='lead' rows
"""

import os
import re
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
    LAST_ERROR,
)

DELAY_BETWEEN_CALLS = 13.0  # stays under Groq free-tier 8k TPM (~5 calls/min)
MAX_BACKOFF_S = 15 * 60     # never sleep longer than this on one row
TPD_COOLDOWN_FLOOR = 60.0   # minimum extra wait after a daily-quota 429

VALID_LABELS = {"lead", "normal", "spam"}


def tpd_retry_seconds() -> float:
    """Parse 'Please try again in 4m49.872s' style hints from the last 429."""
    m = re.search(r"try again in\s+((?:(\d+)h)?(?:(\d+)m)?([\d.]+)s)", str(LAST_ERROR or ""))
    if not m:
        return 120.0
    hours = int(m.group(2) or 0)
    minutes = int(m.group(3) or 0)
    seconds = float(m.group(4) or 0)
    return min(hours * 3600 + minutes * 60 + seconds + TPD_COOLDOWN_FLOOR, MAX_BACKOFF_S)


def classify_patient(sender, subject, body, max_cycles=60):
    """
    classify_email_llm() with patient daily-quota handling.
    Returns (result, waited_total). Sleeps through TPD windows instead of
    giving up, so a 200k-token day never causes skipped rows.
    """
    waited = 0.0
    for cycle in range(max_cycles):
        result = classify_email_llm(sender, subject, body)
        if result is not None:
            return result, waited
        err = str(LAST_ERROR or "")
        if "tokens per day" in err or "TPD" in err:
            wait = tpd_retry_seconds()
            print(f"    daily quota exhausted — sleeping {wait/60:.1f} min, then retrying "
                  f"(cycle {cycle + 1}/{max_cycles})", flush=True)
            time.sleep(wait)
            waited += wait
            continue
        # Transient (429 TPM, timeout, parse error): short wait, retry
        hint = re.search(r"try again in\s+([\d.]+)s", err)
        time.sleep(min(float(hint.group(1)) + 2, 60) if hint else 20)
        waited += 20
    return None, waited


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser()
    parser.add_argument("--only-leads", action="store_true",
                        help="Only re-classify rows currently labeled 'lead'")
    parser.add_argument("--delay", type=float, default=DELAY_BETWEEN_CALLS,
                        help="Seconds between API calls (default 13.0, Groq free-tier)")
    args = parser.parse_args()

    if not get_provider_label():
        print("ERROR: no LLM API key found. Set one of:\n"
              "  GROQ_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, label FROM emails
        WHERE message_id IS NOT NULL AND message_id != ''
        ORDER BY CASE WHEN label = 'lead' THEN 0 ELSE 1 END, id
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if args.only_leads:
        rows = [r for r in rows if r["label"] == "lead"]

    print("=" * 72)
    print(f"RELABEL EXISTING EMAILS — LLM ({get_provider_label()} / {get_model_name()})")
    print(f"Rows to re-classify: {len(rows)} (writes labels back to the DB in place)")
    print("=" * 72)

    stats = {"done": 0, "changed": 0, "failed": 0, "skipped_lead": 0}
    changes = []          # (id, sender, subject, old, new) for the report
    started = time.time()

    for i, row in enumerate(rows, 1):
        rid = row["id"]

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT id, sender, subject, body, label, status FROM emails WHERE id = ?", (rid,))
        current = cur.fetchone()
        if current is None:
            conn.close()
            continue
        sender = current["sender"] or ""
        subject = current["subject"] or ""
        old_label = current["label"] or ""
        status = current["status"] or ""

        result, waited = classify_patient(sender, subject, current["body"] or "")
        if result is None:
            conn.close()
            stats["failed"] += 1
            print(f"  [{i}/{len(rows)}] id={rid} FAILED after patient retries — left as {old_label}")
            continue
        if waited > 60:
            print(f"    (resumed after {waited/60:.1f} min of quota waiting)", flush=True)

        new_label = result["label"]
        if new_label not in VALID_LABELS:
            conn.close()
            stats["failed"] += 1
            continue

        # Skip rows that were relabeled by another process while we ran
        if old_label == "lead" and new_label != "lead" and status in ("followed_up", "resolved"):
            stats["skipped_lead"] += 1
            conn.close()
            print(f"  [{i}/{len(rows)}] id={rid} SKIPPED (human follow-up already sent)")
            time.sleep(args.delay)
            continue

        cur.execute("""
            UPDATE emails
            SET label = ?, confidence = ?, intent = ?, priority = ?
            WHERE id = ?
        """, (new_label, result["confidence"], result["intent"], result["priority"], rid))
        conn.commit()
        conn.close()

        stats["done"] += 1
        if new_label != old_label:
            stats["changed"] += 1
            changes.append((rid, sender, subject, old_label, new_label))
            marker = "lead->" + new_label if old_label == "lead" else f"{old_label}->lead"
            print(f"  [{i}/{len(rows)}] id={rid} CHANGED {marker:<12} {sender[:34]:<34} | {subject[:40]}")
        else:
            print(f"  [{i}/{len(rows)}] id={rid} same     {old_label:<6} {sender[:34]:<34} | {subject[:40]}")

        time.sleep(args.delay)

    elapsed = (time.time() - started) / 60
    print()
    print("=" * 72)
    print("SUMMARY")
    print("=" * 72)
    print(f"  Rows re-classified:   {stats['done']}/{len(rows)}")
    print(f"  Labels changed:       {stats['changed']}")
    print(f"  Labels unchanged:     {stats['done'] - stats['changed']}")
    print(f"  Follow-ups preserved: {stats['skipped_lead']}")
    print(f"  Failed:               {stats['failed']}")
    print(f"  Elapsed:              {elapsed:.1f} min (incl. quota waits)")
    print()
    if changes:
        print("CHANGED LABELS:")
        for rid, sender, subject, old, new in changes:
            print(f"  id={rid:<5} {old:>6} -> {new:<6} | {sender[:36]:<36} | {subject[:52]}")
    else:
        print("No labels changed.")
    print()
    print("Done — dashboard now serves the updated labels.")


if __name__ == "__main__":
    main()
