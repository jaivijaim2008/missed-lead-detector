import os
import sys
import sqlite3
import argparse
from datetime import datetime, timedelta

# Configure Windows console for UTF-8 encoding
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "leads.db")



def detect_missed_leads(missed_after_minutes=60, verbose=True):
    """
    Find any 'new' leads received before the SLA deadline and update status to 'missed'.
    Returns (updated_count, list_of_missed_leads).
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    now = datetime.now()
    deadline = now - timedelta(minutes=missed_after_minutes)

    cursor.execute("""
        UPDATE emails
        SET status = 'missed'
        WHERE label = 'lead'
        AND status = 'new'
        AND received_at < ?
    """, (deadline.isoformat(),))

    updated = cursor.rowcount
    conn.commit()

    cursor.execute("""
        SELECT id, sender, subject, priority, status, received_at, intent
        FROM emails
        WHERE label = 'lead'
        ORDER BY id DESC
    """)

    rows = cursor.fetchall()
    conn.close()

    missed_leads = [
        {
            "id": r[0],
            "sender": r[1],
            "subject": r[2],
            "priority": r[3],
            "status": r[4],
            "received_at": r[5],
            "intent": r[6]
        }
        for r in rows if r[4] == "missed"
    ]

    if verbose:
        print("\n" + "=" * 50)
        print("MISSED LEAD SLA CHECK")
        print("=" * 50)
        print(f"SLA Response Window: {missed_after_minutes} minute(s)")
        print(f"Newly marked as missed: {updated}")
        print(f"Total currently missed leads: {len(missed_leads)}\n")

        for lead in missed_leads:
            print(f"- [ID {lead['id']}] [{lead['priority'].upper()}] \"{lead['subject']}\"")
            print(f"  From: {lead['sender']} | Received: {lead['received_at']}")

        print("=" * 50)

    return updated, missed_leads


def main():
    parser = argparse.ArgumentParser(description="Scan database and mark leads exceeding SLA as 'missed'.")
    parser.add_argument("--minutes", "-m", type=int, default=60, help="SLA response threshold in minutes (default: 60)")
    args = parser.parse_args()

    detect_missed_leads(missed_after_minutes=args.minutes)


if __name__ == "__main__":
    main()

