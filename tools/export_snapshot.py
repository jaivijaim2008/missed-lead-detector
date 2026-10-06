import sqlite3
import json

conn = sqlite3.connect('app/leads.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT * FROM emails WHERE label = 'lead' ORDER BY id DESC LIMIT 25")
leads = [dict(r) for r in c.fetchall()]

c.execute("SELECT * FROM activity_log ORDER BY id DESC LIMIT 30")
activities = [dict(r) for r in c.fetchall()]

with open('frontend/src/lib/demoSnapshot.json', 'w', encoding='utf-8') as f:
    json.dump({'leads': leads, 'activities': activities}, f, indent=2)

print(f"Exported {len(leads)} leads and {len(activities)} activities successfully!")
conn.close()
