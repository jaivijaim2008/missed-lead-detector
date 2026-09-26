"""
sync_real_inbox.py
------------------
Clears all simulated/fake data from the database and fetches ONLY
real emails from your Gmail inbox (jaivijai188@gmail.com).

Run from project root:
    python sync_real_inbox.py
    python sync_real_inbox.py --max 50       # fetch up to 50 emails
    python sync_real_inbox.py --keep-data    # don't wipe existing data
    python sync_real_inbox.py --sent         # also fetch Sent folder
"""

import os
import sys
import sqlite3
import argparse
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.database import DB_PATH, create_database
from app.fetch_gmail import fetch_and_process_emails

SCOPES_SEND = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]

TOKEN_SEND_FILE = os.path.join(BASE_DIR, "credentials", "token_send.json")
TOKEN_READONLY_FILE = os.path.join(BASE_DIR, "credentials", "token.json")
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials", "credentials.json")


def get_service_with_full_scope():
    """Get Gmail service with full scopes (read + send). Tries send token first."""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    import webbrowser

    # Try the send-scoped token first (created by send_test_emails.py)
    for token_path, scopes in [
        (TOKEN_SEND_FILE, SCOPES_SEND),
        (TOKEN_READONLY_FILE, ["https://www.googleapis.com/auth/gmail.readonly"]),
    ]:
        if os.path.exists(token_path):
            try:
                creds = Credentials.from_authorized_user_file(token_path, scopes)
                if creds and creds.valid:
                    return build("gmail", "v1", credentials=creds)
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                    with open(token_path, "w") as f:
                        f.write(creds.to_json())
                    return build("gmail", "v1", credentials=creds)
            except Exception:
                continue

    # Need fresh auth
    print("\n" + "="*60)
    print("GMAIL AUTHORIZATION REQUIRED")
    print("="*60)
    print("A browser window will open. Please sign in and allow access.")
    print("="*60 + "\n")
    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES_SEND)
    webbrowser.open = lambda url, **kw: os.system(f'start "" "{url}"')
    creds = flow.run_local_server(port=0)
    with open(TOKEN_SEND_FILE, "w") as f:
        f.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def wipe_simulated_data():
    """Delete all rows that have no real Gmail message_id (i.e., simulated data)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM emails")
    total_before = cursor.fetchone()[0]

    # Simulated emails have NULL message_id or message_id starting with 'sim_'
    cursor.execute("""
        DELETE FROM emails
        WHERE message_id IS NULL
           OR message_id = ''
           OR message_id LIKE 'sim_%'
           OR message_id LIKE 'test_%'
    """)
    deleted = cursor.rowcount

    cursor.execute("SELECT COUNT(*) FROM emails")
    total_after = cursor.fetchone()[0]

    # Clear activity log too (since it referenced fake leads)
    cursor.execute("DELETE FROM activity_log")

    conn.commit()
    conn.close()

    print(f"\n🗑️  Wiped simulated data:")
    print(f"   Before: {total_before} rows")
    print(f"   Deleted: {deleted} simulated rows")
    print(f"   After:  {total_after} real rows remaining")
    return deleted


def fetch_real_inbox(max_results=500, include_sent=False, force=False, progress_callback=None):
    """Fetch real emails from Gmail inbox and classify them."""
    print("\n" + "="*60)
    print("SYNCING REAL GMAIL INBOX → jaivijai188@gmail.com")
    print("="*60)

    # Fetch INBOX
    print("\n📥 Fetching INBOX emails...")
    inbox_results = fetch_and_process_emails(
        max_results=max_results,
        query="label:INBOX",
        unread_only=False,
        force=force,
        progress_callback=progress_callback
    )

    if include_sent:
        print("\n📤 Fetching SENT emails...")
        fetch_and_process_emails(
            max_results=min(20, max_results // 2),
            query="label:SENT",
            unread_only=False,
            force=force,
            progress_callback=progress_callback
        )

    return inbox_results


def print_db_summary():
    """Print current database state after sync."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM emails")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM emails WHERE label='lead'")
    leads = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM emails WHERE label='spam'")
    spam = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM emails WHERE label='lead' AND status='missed'")
    missed = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM emails WHERE label='lead' AND priority='high'")
    high_priority = cursor.fetchone()[0]

    conn.close()

    print("\n" + "="*60)
    print("📊 DASHBOARD DATABASE STATE")
    print("="*60)
    print(f"   Total Emails in DB:  {total}")
    print(f"   ├── Leads:           {leads} (High Priority: {high_priority})")
    print(f"   ├── Spam:            {spam}")
    print(f"   ├── General:         {total - leads - spam}")
    print(f"   └── Missed Leads:    {missed}")
    print("="*60)
    print("\n✅ Dashboard is now showing ONLY your real Gmail emails.")
    print("   Open: http://localhost:3000")
    print("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Clear fake data and sync real Gmail inbox into dashboard."
    )
    parser.add_argument("--max", type=int, default=30,
                        help="Max emails to fetch from inbox (default: 30)")
    parser.add_argument("--keep-data", action="store_true",
                        help="Don't wipe existing data, just add new emails")
    parser.add_argument("--sent", action="store_true",
                        help="Also sync Sent folder")
    parser.add_argument("--force", action="store_true",
                        help="Re-process emails already in database")
    args = parser.parse_args()

    create_database()

    print("\n" + "="*60)
    print(" LeadGuard — Real Gmail Inbox Sync")
    print("="*60)

    if not args.keep_data:
        print("\n⚠️  Step 1: Clearing simulated/fake data...")
        wipe_simulated_data()
    else:
        print("\n⏭️  Skipping data wipe (--keep-data flag set)")

    print("\n📡 Step 2: Fetching real emails from Gmail...")
    time.sleep(1)

    try:
        fetch_real_inbox(
            max_results=args.max,
            include_sent=args.sent,
            force=args.force
        )
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Gmail sync failed: {e}")
        print("\nIf you see 'invalid_scope', run send_test_emails.py first")
        print("to re-authorize with full permissions.")
        sys.exit(1)

    print_db_summary()


if __name__ == "__main__":
    main()
