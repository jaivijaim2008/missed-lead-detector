import os
import sys
import random
from datetime import datetime, timedelta

# Ensure paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from database import create_database, save_email, email_exists
from process_email import process_email

# Realistic sample emails across various categories
SAMPLE_EMAILS = [
    {
        "sender": "sarah.connor@acme-corp.com",
        "subject": "Enterprise Pricing & Volume Discount Inquiry",
        "body": "Hi Sales Team, We are looking to deploy your solution across 250 team members. Could you share your enterprise tier pricing and volume discounts? We would like to finalize the purchase before the end of the quarter.",
        "minutes_ago": 120,  # 2 hours ago -> will trigger missed lead SLA!
        "category": "pricing/purchase"
    },
    {
        "sender": "david.miller@fintechglobal.io",
        "subject": "Request for Product Demo - Q4 Rollout",
        "body": "Hello, I came across your tool and it seems like a great fit for our compliance workflow. Can we schedule a 30-minute demo call this Thursday or Friday afternoon?",
        "minutes_ago": 90,  # 1.5 hours ago -> will trigger missed lead SLA!
        "category": "meeting/demo"
    },
    {
        "sender": "elena.rostova@nexusventures.co",
        "subject": "Strategic Partnership & API Integration",
        "body": "Hi there, We are exploring integration partners for our CRM ecosystem. Would love to connect with your business development lead to discuss a potential co-marketing and integration partnership.",
        "minutes_ago": 45,  # 45 minutes ago
        "category": "partnership"
    },
    {
        "sender": "marcus.chen@techstartup.ai",
        "subject": "Question regarding SOC2 compliance and API rate limits",
        "body": "Hello, I am evaluating your API for our SaaS application. Do you support custom rate limits and are you SOC2 Type II certified? Looking forward to your response.",
        "minutes_ago": 10,  # 10 minutes ago -> fresh lead!
        "category": "product_inquiry"
    },
    {
        "sender": "jason.vance@quickbuy-deals.net",
        "subject": "EXCLUSIVE OFFER: Grow your website traffic 10x overnight!",
        "body": "Dear Webmaster, Buy 1,000,000 high quality backlink packages for only $49. Limited time flash sale! Click here to claim your guaranteed traffic boost.",
        "minutes_ago": 30,
        "category": "spam"
    },
    {
        "sender": "hr-updates@workplace-portal.com",
        "subject": "Monthly Internal Company Newsletter - September Edition",
        "body": "Team, please find attached the internal town hall recording and Q3 company updates. The office will remain closed this upcoming Monday.",
        "minutes_ago": 60,
        "category": "general"
    },
    {
        "sender": "rachel.adams@cloudscale.org",
        "subject": "Urgent: Quotation needed for annual subscription",
        "body": "Hi, we are ready to purchase the annual business plan for 15 seats. Could you please send an official invoice and payment link today? Thanks!",
        "minutes_ago": 180,  # 3 hours ago -> definitely missed SLA!
        "category": "pricing/purchase"
    }
]


def inject_simulated_emails(count=None, force=False):
    """
    Inject realistic simulated incoming emails into the SQLite database.
    Calculates realistic received_at timestamps so SLA checks can be demoed immediately.
    """
    create_database()

    emails_to_inject = SAMPLE_EMAILS
    if count and count < len(SAMPLE_EMAILS):
        emails_to_inject = random.sample(SAMPLE_EMAILS, count)

    print("\n" + "=" * 55)
    print("SIMULATING INCOMING EMAILS FOR LEAD DETECTOR")
    print("=" * 55)

    now = datetime.now()
    injected_count = 0
    skipped_count = 0

    for idx, item in enumerate(emails_to_inject, 1):
        # Generate a deterministic mock message_id
        simulated_id = f"sim_{abs(hash(item['sender'] + item['subject'])) % 1000000:06d}"

        if not force and email_exists(simulated_id):
            print(f"[{idx}/{len(emails_to_inject)}] Already exists: '{item['subject'][:40]}...' (ID: {simulated_id})")
            skipped_count += 1
            continue

        received_time = now - timedelta(minutes=item["minutes_ago"])

        result = process_email(
            sender=item["sender"],
            subject=item["subject"],
            body=item["body"],
            received_at=received_time.isoformat(),
            message_id=simulated_id,
            verbose=False
        )

        injected_count += 1
        label = result.get("label", result.get("prediction", "general"))
        priority = result.get("priority", "low")

        print(f"[{idx}/{len(emails_to_inject)}] Injected: \"{item['subject']}\"")
        print(f"       From: {item['sender']} ({item['minutes_ago']} mins ago)")
        print(f"       Classified as: [{label.upper()}] | Priority: {priority.upper()} | Intent: {result['intent']}")

    print("\n" + "=" * 55)
    print(f"SIMULATION SUMMARY: Injected {injected_count} new email(s), {skipped_count} skipped.")
    print("=" * 55)

    return injected_count


if __name__ == "__main__":
    inject_simulated_emails()
