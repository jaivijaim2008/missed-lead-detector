"""
send_test_emails.py
-------------------
Sends realistic sales-lead test emails TO jaivijai188@gmail.com
using Gmail API (OAuth2 - no SMTP passwords needed).

Run from project root:
    python send_test_emails.py
"""

import os
import sys
import base64
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configure Windows console for UTF-8 encoding
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials", "credentials.json")
TOKEN_FILE = os.path.join(BASE_DIR, "credentials", "token_send.json")

# ─── Authorize with send+read scopes ─────────────────────────────────────────
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]

def get_send_service():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    import webbrowser, os

    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            print("\n" + "="*60)
            print("GMAIL AUTHORIZATION REQUIRED")
            print("="*60)
            print("A browser window will open. Please:")
            print("  1. Sign in to jaivijai188@gmail.com")
            print("  2. Allow the requested permissions")
            print("="*60 + "\n")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            webbrowser.open = lambda url, **kw: os.system(f'start "" "{url}"')
            creds = flow.run_local_server(port=0,
                success_message="Auth done! Return to terminal.")
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


# ─── Test email templates ─────────────────────────────────────────────────────
TEST_EMAILS = [
    {
        "from_name": "Rajesh Kumar",
        "from_email": "rajesh.kumar@techsolutions.co.in",
        "subject": "Enterprise Software Pricing Request — 200 seats",
        "body": """Hi,

I'm Rajesh Kumar, Head of IT Procurement at TechSolutions India.

We are evaluating sales automation tools for our 200-person sales team and came across your platform. 

Could you please share:
- Pricing for 200 user licenses
- Annual vs monthly billing options
- Volume discount structure
- Implementation timeline and support

We have a budget review meeting on Friday and would love to finalize a vendor by then.

Looking forward to your response.

Best regards,
Rajesh Kumar
Head of IT Procurement
TechSolutions India Pvt. Ltd.
+91-98765-43210"""
    },
    {
        "from_name": "Sarah Mitchell",
        "from_email": "sarah.mitchell@globalretail.com",
        "subject": "Demo Request — Automated Lead Detection System",
        "body": """Hello Team,

I found your product through a LinkedIn post and I'm very interested in a live demo.

We're a global retail company with 50+ stores and struggling to track inbound inquiries from wholesale buyers. Our current system misses almost 30% of leads.

Can we schedule a 30-minute demo call this week or next? 

Our team is available:
- Tuesday 3-5 PM IST
- Thursday 10 AM - 12 PM IST

Please let me know what works for you.

Thanks,
Sarah Mitchell
Director of Sales Operations
Global Retail Group"""
    },
    {
        "from_name": "Mohammed Al-Farsi",
        "from_email": "m.alfarsi@innovatetech.ae",
        "subject": "Urgent: Partnership Opportunity - Middle East Distribution",
        "body": """Dear Sales Team,

I represent InnovateTech UAE, a technology distribution company covering the GCC region (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman).

We are looking for a strategic software partner to distribute your lead detection solution to our portfolio of 500+ enterprise clients across the Middle East.

This is a high-priority opportunity. Our CEO would like to connect this week if possible.

Can you arrange a call with your business development head?

Regards,
Mohammed Al-Farsi
VP Business Development
InnovateTech UAE
+971-50-123-4567"""
    },
    {
        "from_name": "Priya Sharma",
        "from_email": "priya.sharma@startupventures.io",
        "subject": "Quick question about your API integration",
        "body": """Hi,

I'm a product manager at a B2B SaaS startup. We're building a CRM and want to integrate an AI lead classifier directly into our pipeline via API.

A few questions:
1. Do you offer a REST API for email classification?
2. What's the rate limit on the API?
3. Is there a sandbox/test environment?
4. What's the pricing model — per-call or monthly flat fee?

We're ready to start development immediately if the API supports our use case.

Thanks,
Priya Sharma
Product Manager
StartupVentures.io"""
    },
    {
        "from_name": "David Chen",
        "from_email": "d.chen@fortunemanufacturing.com",
        "subject": "ROI Analysis — Missed Lead Recovery Software",
        "body": """Hello,

We're a mid-sized manufacturing company and recently realized we've been losing roughly $2M/year in missed inbound leads that go unanswered for more than 48 hours.

I've been researching automated lead recovery solutions and yours came highly recommended.

Could you send me:
1. A case study or ROI analysis from similar companies
2. Your implementation process and timeline
3. Integration options with Salesforce CRM
4. A pricing quote for 50 users

We're ready to move fast — ideally want something deployed within 30 days.

Best,
David Chen
VP Sales
Fortune Manufacturing Co."""
    },
    {
        "from_name": "Ananya Reddy",
        "from_email": "ananya.reddy@eductechpro.edu",
        "subject": "Educational Institution Discount Available?",
        "body": """Dear Team,

I'm reaching out from EduTech Pro, an ed-tech company serving 300+ schools across India.

We handle a large volume of inbound inquiries from schools and parents daily and find it impossible to manually track which ones are high-intent.

Do you offer special pricing for educational institutions or NGOs?

Also, can this system integrate with:
- WhatsApp Business API
- Google Workspace
- Zoho CRM

Looking forward to your response!

Warm regards,
Ananya Reddy
Head of Growth
EduTech Pro"""
    },
    {
        "from_name": "Tom Bergmann",
        "from_email": "t.bergmann@eurologistics.de",
        "subject": "Interested in Your Platform — Logistics Sector",
        "body": """Good day,

I am Tom Bergmann from Euro Logistics GmbH based in Hamburg, Germany.

We operate a fleet of 800 trucks across Europe and receive approximately 200 emails per day from potential freight customers. We lose track of many of these inquiries and believe an AI system would help.

Please provide:
- GDPR compliance documentation
- On-premise deployment option (we cannot use cloud for data security)
- German-language support
- Pricing in EUR

We're serious buyers. Can we talk this week?

Mit freundlichen Grüßen,
Tom Bergmann
Operations Director
Euro Logistics GmbH"""
    },
    {
        "from_name": "Fatima Al-Hassan",
        "from_email": "fatima@healthcareplus.sa",
        "subject": "Healthcare CRM Lead Management — Urgent Need",
        "body": """Assalamu Alaikum,

We are a private healthcare group in Saudi Arabia operating 12 clinics across Riyadh.

Patient inquiry management is a major challenge — we miss 40% of appointment requests from new patients. This is a critical business problem that is costing us both revenue and patient satisfaction.

Is your solution suitable for healthcare? We need:
- Arabic language support (at least in email classification)
- HIPAA/NDMO compliance
- Integration with our existing HIS system
- Training and onboarding support in Saudi Arabia

Budget is not a constraint for the right solution.

Regards,
Fatima Al-Hassan
Digital Transformation Manager
HealthcarePlus Group KSA"""
    },
    {
        "from_name": "Jake Williams",
        "from_email": "jake.w@realestatepro.us",
        "subject": "Real Estate Lead Management — Urgent Inquiry",
        "body": """Hi there,

I run a real estate brokerage in Miami with 45 agents. Our #1 problem is agents missing hot leads in their email.

A buyer emailing us at 9 PM on a Friday expecting a callback the next morning — our agents miss these constantly.

Questions:
1. Can your system notify agents via SMS when a high-priority lead comes in?
2. Is there a mobile app?
3. Can we auto-assign leads to specific agents based on location or property type?
4. What's onboarding like for non-tech-savvy agents?

Ready to sign up if this meets our needs.

Jake Williams
Broker/Owner
RealEstatePro Miami"""
    },
    {
        "from_name": "Sneha Patel",
        "from_email": "sneha.patel@digitalagency.in",
        "subject": "White-Label Reseller Opportunity",
        "body": """Hi Team,

We are a digital marketing agency based in Pune, India with 200+ SME clients.

We're looking to white-label a lead management SaaS tool and offer it to our clients under our own brand.

Can you please share:
- White-label/OEM pricing
- Customization options (logo, color scheme, domain)
- API access for integration into our client portals
- Revenue share or reseller margin structure
- Technical requirements and support SLA

This would be an exclusive arrangement if terms are right.

Looking forward to a conversation.

Best,
Sneha Patel
CEO & Founder
Digital Agency India"""
    },
]

TARGET_EMAIL = "jaivijai188@gmail.com"


def create_message(service_email, from_name, from_email, subject, body):
    """Create a Gmail API message object."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = TARGET_EMAIL
    msg["Reply-To"] = from_email

    # Plain text part
    text_part = MIMEText(body, "plain", "utf-8")
    msg.attach(text_part)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return {"raw": raw}


def send_all_test_emails():
    print("\n" + "="*60)
    print("SENDING TEST EMAILS TO:", TARGET_EMAIL)
    print("="*60)

    try:
        service = get_send_service()
    except Exception as e:
        print(f"\n❌ Failed to authenticate: {e}")
        print("\nMake sure credentials.json is in the credentials/ directory.")
        return

    profile = service.users().getProfile(userId="me").execute()
    sender_account = profile.get("emailAddress", "unknown")
    print(f"\n✅ Sending from: {sender_account}")
    print(f"✅ Sending to:   {TARGET_EMAIL}")
    print(f"📧 Total emails: {len(TEST_EMAILS)}\n")

    success_count = 0
    fail_count = 0

    for i, email_data in enumerate(TEST_EMAILS, 1):
        try:
            message = create_message(
                service_email=sender_account,
                from_name=email_data["from_name"],
                from_email=email_data["from_email"],
                subject=email_data["subject"],
                body=email_data["body"]
            )

            service.users().messages().send(
                userId="me",
                body=message
            ).execute()

            print(f"[{i:2d}/{len(TEST_EMAILS)}] ✅ Sent: \"{email_data['subject']}\"")
            print(f"          From: {email_data['from_name']} <{email_data['from_email']}>")
            success_count += 1

            # Small delay to avoid rate limiting
            if i < len(TEST_EMAILS):
                time.sleep(1.5)

        except Exception as e:
            print(f"[{i:2d}/{len(TEST_EMAILS)}] ❌ Failed: \"{email_data['subject']}\"")
            print(f"          Error: {e}")
            fail_count += 1

    print("\n" + "="*60)
    print("SEND SUMMARY")
    print("="*60)
    print(f"✅ Successfully sent: {success_count}/{len(TEST_EMAILS)}")
    if fail_count:
        print(f"❌ Failed:           {fail_count}/{len(TEST_EMAILS)}")
    print(f"\n📬 Check your Gmail inbox at {TARGET_EMAIL}")
    print("   Emails may take 1-2 minutes to appear.")
    print("="*60)
    print("\n⏭️  Next step: Run 'python sync_real_inbox.py' to pull these")
    print("   emails into the dashboard.")


if __name__ == "__main__":
    send_all_test_emails()
