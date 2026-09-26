import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "leads.db")


def create_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT UNIQUE,
            sender TEXT,
            subject TEXT,
            body TEXT,
            label TEXT,
            confidence REAL,
            intent TEXT,
            priority TEXT,
            status TEXT DEFAULT 'new',
            received_at TEXT
        )
    """)

    # Ensure message_id column exists if table was previously created without it
    cursor.execute("PRAGMA table_info(emails)")
    columns = [col[1] for col in cursor.fetchall()]
    if "message_id" not in columns:
        cursor.execute("ALTER TABLE emails ADD COLUMN message_id TEXT")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id)")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            actor TEXT,
            action TEXT,
            lead_id INTEGER,
            details TEXT
        )
    """)

    conn.commit()
    conn.close()


def email_exists(message_id):
    if not message_id:
        return False
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM emails WHERE message_id = ?", (message_id,))
    row = cursor.fetchone()
    conn.close()
    return row is not None


def save_email(sender, subject, body, label, confidence, intent, priority, received_at, message_id=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT OR IGNORE INTO emails
        (sender, subject, body, label, confidence, intent, priority, received_at, message_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        sender,
        subject,
        body,
        label,
        confidence,
        intent,
        priority,
        received_at,
        message_id
    ))

    conn.commit()
    conn.close()


def update_lead_status(lead_id, new_status):
    """Update status of a lead (e.g. 'new', 'missed', 'followed_up', 'resolved')."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE emails
        SET status = ?
        WHERE id = ?
    """, (new_status, lead_id))
    conn.commit()
    conn.close()


def get_lead_stats():
    """Return dictionary of aggregated stats for reporting and dashboard."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM emails")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM emails WHERE label = 'lead'")
    leads = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM emails WHERE label = 'spam'")
    spam = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM emails WHERE label NOT IN ('lead', 'spam')")
    general = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM emails WHERE label = 'lead' AND status = 'new'")
    new_leads = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM emails WHERE label = 'lead' AND status = 'missed'")
    missed_leads = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM emails WHERE label = 'lead' AND status IN ('followed_up', 'resolved')")
    resolved_leads = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM emails WHERE label = 'lead' AND priority = 'high'")
    high_priority = cursor.fetchone()[0]

    conn.close()

    return {
        "total": total,
        "leads": leads,
        "spam": spam,
        "general": general,
        "new_leads": new_leads,
        "missed_leads": missed_leads,
        "resolved_leads": resolved_leads,
        "high_priority": high_priority
    }


def get_emails():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM emails
        ORDER BY id DESC
    """)

    rows = cursor.fetchall()
    conn.close()
    return rows


def log_activity(action, lead_id=None, details=None, actor="System"):
    """Record an audit trail event in the activity_log table."""
    from datetime import datetime
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO activity_log (timestamp, actor, action, lead_id, details)
        VALUES (?, ?, ?, ?, ?)
    """, (datetime.now().isoformat(), actor, action, lead_id, details))
    conn.commit()
    conn.close()


def get_activities(limit=50):
    """Retrieve recent audit activity logs."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*, e.sender, e.subject, e.priority
        FROM activity_log a
        LEFT JOIN emails e ON a.lead_id = e.id
        ORDER BY a.id DESC
        LIMIT ?
    """, (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def get_lead_by_id(lead_id):
    """Fetch single email/lead by ID as a dictionary."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM emails WHERE id = ?", (lead_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


if __name__ == "__main__":
    create_database()
    print("Database created/updated successfully!")


