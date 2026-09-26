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


import re
import argparse

try:
    from app.database import update_lead_status
except ImportError:
    from database import update_lead_status


def extract_recipient_name(sender):
    """Extract a clean first name from a sender string like 'John Doe <john@example.com>' or 'john.doe@...'."""
    if not sender:
        return "there"
    match = re.match(r"^([^<@]+)", sender)
    if match:
        name_part = match.group(1).strip().strip('"\'')
        name_part = re.split(r"[\s._]+", name_part)[0]
        if len(name_part) > 1 and not name_part.isdigit():
            return name_part.capitalize()
    return "there"


def generate_followup(subject, intent, priority, sender=None):
    """Generate tailored follow-up copy based on lead intent and priority."""
    name = extract_recipient_name(sender)

    if intent == "pricing/purchase":
        urgency_note = "I would be happy to fast-track an official quote or customize a volume plan for you." if priority == "high" else "Feel free to let us know your requirements so we can share the best pricing options."
        return (
            f"Hi {name},\n\n"
            "Thank you for reaching out regarding our pricing and packages. "
            "I wanted to follow up promptly on your inquiry.\n\n"
            f"{urgency_note}\n\n"
            "Would you be open to a quick 10-minute call this week to review the options?\n\n"
            "Best regards,\n"
            "Sales Team"
        )

    if intent == "meeting/demo":
        return (
            f"Hi {name},\n\n"
            "Thank you for your interest in our platform! I apologize for the slight delay in getting back to you. "
            "We would love to show you a personalized walkthrough of the product.\n\n"
            "Could you let us know 2-3 time slots that work best for your schedule over the next few days?\n\n"
            "Looking forward to connecting!\n\n"
            "Best regards,\n"
            "Product Team"
        )

    if intent == "partnership":
        return (
            f"Hi {name},\n\n"
            "Thank you for contacting us regarding a potential partnership and integration. "
            "We are always eager to explore synergistic collaborations.\n\n"
            "Could you share a bit more context on your ecosystem, or suggest a good time to jump on a discovery call?\n\n"
            "Best regards,\n"
            "Business Development Team"
        )

    # General product inquiry fallback
    return (
        f"Hi {name},\n\n"
        "Thank you for reaching out to us. I wanted to follow up on your recent question. "
        "Please let us know if you need any additional specifications or documentation, "
        "and our team will be glad to assist.\n\n"
        "Best regards,\n"
        "Support & Sales Team"
    )


def get_missed_leads_with_drafts(limit=None):
    """Retrieve missed leads from DB and attach ready-to-send follow-up email drafts."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    query = """
        SELECT id, sender, subject, intent, priority, received_at
        FROM emails
        WHERE label = 'lead'
        AND status = 'missed'
        ORDER BY id DESC
    """
    if limit:
        query += f" LIMIT {int(limit)}"

    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    drafts = []
    for r in rows:
        lead_id, sender, subject, intent, priority, received_at = r
        draft_body = generate_followup(
            subject=subject,
            intent=intent,
            priority=priority,
            sender=sender
        )
        drafts.append({
            "lead_id": lead_id,
            "to": sender,
            "subject": f"Following up: {subject}",
            "intent": intent,
            "priority": priority,
            "received_at": received_at,
            "draft_body": draft_body
        })

    return drafts


def main():
    parser = argparse.ArgumentParser(description="Generate automated follow-up drafts for missed leads.")
    parser.add_argument("--limit", "-l", type=int, default=None, help="Number of missed leads to generate drafts for")
    parser.add_argument("--mark-sent", action="store_true", help="Update lead status to 'followed_up' in DB")
    args = parser.parse_args()

    drafts = get_missed_leads_with_drafts(limit=args.limit)

    print("\n" + "=" * 55)
    print("AUTOMATED FOLLOW-UP DRAFT ENGINE")
    print("=" * 55)

    if not drafts:
        print("\nNo missed leads currently requiring follow-up.")
        print("=" * 55)
        return

    print(f"\nGenerated {len(drafts)} follow-up draft(s):\n")

    for idx, d in enumerate(drafts, 1):
        print(f"[{idx}] LEAD ID #{d['lead_id']} | Priority: {d['priority'].upper()} | Intent: {d['intent']}")
        print(f"To: {d['to']}")
        print(f"Subject: {d['subject']}")
        print("-" * 45)
        print(d["draft_body"])
        print("-" * 45 + "\n")

        if args.mark_sent:
            update_lead_status(d["lead_id"], "followed_up")
            print(f"-> Marked Lead #{d['lead_id']} status as 'followed_up'.\n")

    print("=" * 55)


if __name__ == "__main__":
    main()

