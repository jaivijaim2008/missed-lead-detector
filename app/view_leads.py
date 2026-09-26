import os
import sys
import sqlite3

# Configure Windows console for UTF-8 encoding
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "leads.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("""
    SELECT
        id,
        sender,
        subject,
        label,
        confidence,
        intent,
        priority,
        status,
        received_at
    FROM emails
    ORDER BY id DESC
""")

rows = cursor.fetchall()

print("\n==============================")
print("EMAIL / LEAD DATABASE")
print("==============================")

if not rows:
    print("No emails found.")

else:
    for row in rows:
        print("\nID:", row[0])
        print("Sender:", row[1])
        print("Subject:", row[2])
        print("Label:", row[3])
        print("Confidence:", round(row[4], 2), "%")
        print("Intent:", row[5])
        print("Priority:", row[6])
        print("Status:", row[7])
        print("Received:", row[8])

conn.close()
