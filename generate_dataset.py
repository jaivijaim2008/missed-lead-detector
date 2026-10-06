"""
Generates dataset/emails.csv — a BALANCED, multi-category inbox dataset.

Categories (the model trains on all of them):
  lead        – a real sales opportunity (pricing, demo, partnership, product question)
  job_alert   – Devpost / Kaggle / Unstop / LinkedIn style job & hackathon alerts
  otp_code    – verification / one-time codes (Google, GitHub, banks...)
  social      – Facebook / Reddit / Instagram / LinkedIn notifications & digests
  newsletter  – product blogs and digests (Ollama, Monetag, TLDR, Substack...)
  spam        – promotions, lottery wins, crypto nonsense
  general     – receipts, statements, appointment confirmations, plain questions

The serving layer (app/process_email.py) maps everything except `lead` and
`spam` to `normal`, so the UI keeps its three simple buckets while the
classifier gets a much sharper decision boundary.
"""

import csv
import random
from datetime import datetime

random.seed(42)

FIRST_NAMES = ["Aarav", "Maya", "Daniel", "Priya", "Leo", "Sofia", "Ethan", "Nina", "Omar", "Grace",
               "Ravi", "Elena", "Jonas", "Amara", "Felix", "Hana", "Marcus", "Ivy", "Tariq", "Chloe"]
LAST_NAMES = ["Sharma", "Chen", "Kim", "Patel", "Gomez", "Novak", "Okafor", "Silva", "Haddad", "Berg",
              "Ivanov", "Tanaka", "Muller", "Rossi", "Dubois", "Smith", "Johnson", "Garcia"]
COMPANIES = ["BrightPath", "Nordwind", "Vireo Labs", "Quantiva", "Helios Retail", "BlueLedge",
             "Craft&Co", "Mistral Analytics", "Orbit Farms", "Zenvia Health", "Kettle Works",
             "Pinebrook Legal", "Atlas Freight", "Lumen Studio", "FerroTech"]
PRODUCTS = ["CRM", "analytics suite", "onboarding tool", "inventory system", "booking platform",
            "email tool", "reporting add-on", "API plan", "team plan"]

# ── Templates ────────────────────────────────────────────────────────────────
# {name} {company} {product} {code} {n} are substituted randomly.

LEAD = [
    "Hi, I'm {name} from {company}. We're evaluating a {product} for our team of {n}. Could you send pricing?",
    "Hello, {company} is looking to buy a {product} this quarter. Can we get a quote?",
    "Interested in your {product}. Do you offer an enterprise plan? We have budget approved.",
    "We saw your {product} at a conference and want a demo for {n} people. When are you free?",
    "Hi, our procurement team at {company} asked me to get pricing for your {product}.",
    "Can we schedule a call next week? We're comparing vendors for a {product} and you're shortlisted.",
    "Hello, I handle partnerships at {company}. Interested in exploring a reseller partnership.",
    "We're migrating tools and need a {product} with SSO. What does pricing look like for {n} seats?",
    "Hi, this is {name}. Our agency wants to purchase your {product} for all client accounts.",
    "Please send your enterprise pricing and SLA details. We plan to roll out to {n} users.",
    "Do you have a plan for startups? We're {n} people and want to buy the {product} this month.",
    "Hello, we'd like a demo of the {product} for our sales team. Budget is already allocated.",
]

JOB_ALERT = [
    "{n} new jobs match your alerts: Backend Engineer at {company}, Data Analyst at Vireo Labs, more inside.",
    "Your job alert: {n} new openings for 'machine learning engineer' near you.",
    "Devpost: The {company} Hackathon starts Monday — {n} teams registered already. Register now.",
    "Kaggle: New competition featured — join {n},000 data scientists already competing.",
    "Unstop: {n} new internships and hackathons match your profile. Application deadline Sunday.",
    "LinkedIn: {n} jobs recommended for you, including Senior PM at {company}.",
    "Your weekly job digest: {n} new roles in your saved searches. Apply in one click.",
    "Internshala: Application deadline alert — the {company} internship closes in 2 days.",
    "Hackathon reminder: {company} AI Challenge submission window closes this Friday.",
    "New roles posted today match your skills: React Developer, QA Lead, and {n} more.",
    "Kaggle community: your ranking changed. {n} new notebooks from people you follow.",
    "Devpost update: your hackathon submission received a new review comment.",
    "Unstop: Satin Finserv is Hiring — grab pre-placement offers before the deadline.",
    "Google is hiring interns! Apply through Unstop with one click.",
    "Paytm is hiring interns — {n} openings across product and engineering.",
    "Earn a stipend upto INR 30,000 this semester. {n} programs are accepting applications.",
    "Compete at Econvista 2026 — {n} competitions, certificates for all participants.",
    "[Hiring Opportunity] Grab a PPI & PPO with Satin Finserv. Round 1 closes Sunday.",
    "Win a ₹10L prize and a shot at a PPO — register for the {company} challenge.",
    "From mock practice to PPOs: how {n},000 students prepared with Unstop.",
    "GE HealthCare internship alert — applications close in {n} days.",
    "You're preparing for your next role. This week's hiring challenges are live.",
]

OTP_CODE = [
    "Your verification code is {code}. It expires in 10 minutes. Don't share it with anyone.",
    "{code} is your one-time code to sign in to {company}. Never share this code.",
    "Use {code} to verify your email address. This code expires shortly.",
    "Your {company} login code: {code}. If you didn't request it, reset your password.",
    "Security code: {code}. Enter it in the app to finish setting up two-factor auth.",
    "Your OTP for password reset is {code}. Valid for the next 5 minutes only.",
    "Someone tried to sign in to your account. Verification code: {code}.",
    "Confirm your phone number with code {code} to secure your {company} account.",
    "Here's your temporary access code: {code}. It works once and expires in 15 minutes.",
    "Your payment needs extra verification. Enter code {code} to approve this transaction.",
    "{company} verification: {code}. Do not forward or share this message.",
    "Your sign-in code is {code}. Didn't try to log in? Someone may know your password.",
]

SOCIAL = [
    "{name} and {n} others commented on a post in {company} Community.",
    "Your weekly Reddit digest: top posts from r/machinelearning and r/startups.",
    "Facebook: {name} tagged you in a photo. See what they shared.",
    "LinkedIn: you appeared in {n} searches this week. See who's viewing your profile.",
    "Instagram: {name} liked your photo. Catch up on what you missed.",
    "Reddit: replies to your comment on 'Best CRM for small teams' — {n} new upvotes.",
    "{name} mentioned you in a thread: 'has anyone here compared pricing tools?'",
    "Your Facebook memories: 3 years ago you shared a photo at {company}.",
    "New follower: {name} just followed you. Check out their profile.",
    "LinkedIn: 5 people from {company} have new roles. Say congrats.",
    "Community digest: your question 'export issues?' has {n} new replies.",
    "You have {n} pending friend suggestions you might know.",
]

NEWSLETTER = [
    "Ollama blog: New model releases this month and what they mean for local inference.",
    "The TLDR: {n} stories shaping tech today — chips, models, and a surprise acquisition.",
    "Monetag monthly: your traffic report and {n} optimization tips for publishers.",
    "Product Hunt digest: the {n} launches everyone is upvoting today.",
    "Substack: 'Survival analysis, explained' — this week's data science deep dive.",
    "Ollama newsletter: performance improvements in the latest release (+{n}% faster loads).",
    "Your weekly digest from Monetag: industry benchmarks and payout schedule updates.",
    "TLDR AI: Open-source models catch up, plus {n} papers worth your weekend.",
    "Product Hunt: today's #1 product is a calendar tool your team might like.",
    "Monthly roundup: everything we shipped — dark mode, exports, and {n} fixes.",
    "Newsletter: 5 pricing pages we loved (and why they convert).",
    "Community blog: a beginner's guide to self-hosting, plus this week's top links.",
    "Ollama digest: what's new this month, plus a look at our roadmap ahead.",
    "Cerebras: the Codex Pro Plan giveaway ends this Sunday — enter while you can.",
    "Reminder: your giveaway entry is still pending. Confirm it before the deadline.",
    "This month in open source: {n} releases worth upgrading for, and one to skip.",
]

SPAM = [
    "CONGRATULATIONS!!! You won the international lottery. Claim your $2,500,000 NOW.",
    "Double your crypto in 24 hours — guaranteed returns, limited slots!!!",
    "You have been selected for a free iPhone 15. Click here to claim within 24 hours.",
    "URGENT: Your account will be suspended. Verify your bank details immediately.",
    "Miracle weight loss pill doctors don't want you to know about. 80% OFF today!!!",
    "Exclusive SEO service — rank #1 on Google or your money back. Reply now!!!",
    "Dear winner, to release your prize funds we need a small processing fee.",
    "Make $5,000/week working from home. No experience needed. Limited spots!",
    "Your package is held at customs. Pay the release fee to receive your parcel.",
    "Cheap certified software — 95% discount, genuine keys, offer ends today!!!",
    "Hot singles in your area want to chat. Sign up free now!!!",
    "Attention: unclaimed inheritance of $8.5M needs your immediate response.",
]

GENERAL = [
    "Your order #{n} has shipped and arrives Thursday. Track it in your account.",
    "Receipt from {company}: your invoice for September is attached as PDF.",
    "Appointment reminder: dentist visit tomorrow at 3:00 PM. Reply CANCEL to change.",
    "Your monthly statement is ready. No action is needed — download it from the portal.",
    "Thanks for contacting support. Your ticket #{n} has been resolved. Reply to reopen.",
    "Meeting rescheduled: the team standup moved to 10:30 AM in your calendar.",
    "Your subscription auto-renewal succeeded. Next billing date is the 14th.",
    "Document shared with you: 'Q3 plan.xlsx' by {name} — view-only access.",
    "Your flight check-in opens in 24 hours. Seats can be selected now.",
    "Password changed successfully. If this wasn't you, contact support immediately.",
    "Water bill for September: amount due in 12 days. View your statement online.",
    "Calendar invite: {name} invited you to 'Vendor call' on Thursday.",
]

CATEGORY_DATA = {
    "lead": LEAD,
    "job_alert": JOB_ALERT,
    "otp_code": OTP_CODE,
    "social": SOCIAL,
    "newsletter": NEWSLETTER,
    "spam": SPAM,
    "general": GENERAL,
}

# Balanced-ish counts: leads are a minority of a real inbox.
COUNTS = {
    "lead": 520,
    "job_alert": 380,
    "otp_code": 230,
    "social": 260,
    "newsletter": 360,
    "spam": 260,
    "general": 260,
}

INTENT = {
    "lead": "product_inquiry",
    "job_alert": "job alert",
    "otp_code": "verification code",
    "social": "social notification",
    "newsletter": "newsletter",
    "spam": "spam",
    "general": "general",
}

SENDERS = {
    "lead": ["{name}.{last}@{co}.com", "hello@{co}.com", "contact@{co}.com"],
    "job_alert": ["noreply@devpost.com", "jobalerts@linkedin.com", "notify@kaggle.com",
                  "alerts@unstop.com", "noreply@internshala.com", "jobs-noreply@linkedin.com",
                  "Ananya Bhatt <noreply@unstop.news>", "Team Unstop <noreply@unstop.news>",
                  "Jia from Unstop <noreply@unstop.news>", "Smriti Jain <noreply@unstop.news>",
                  "Tanu Goel <noreply@unstop.news>"],
    "otp_code": ["noreply@accounts.google.com", "no-reply@github.com", "security@paypal.com",
                 "noreply@x.com", "verify@facebookmail.com", "noreply@stripe.com"],
    "social": ["noreply@redditmail.com", "notification@facebookmail.com", "noreply@instagram.com",
               "messages-noreply@linkedin.com", "info@x.com"],
    "newsletter": ["newsletter@ollama.com", "updates@monetag.com", "digest@tldr.tech",
                   "hello@producthunt.com", "news@substack.com", "hello@ollama.com",
                   "info@cerebras.net", "team@substack.com"],
    "spam": ["winner@lucky-draw.biz", "promo@mega-deals.info", "support@crypto4x.win",
             "offers@cheapsoft.io", "prize@claim-center.xyz"],
    "general": ["receipts@stripe.com", "noreply@calendar-app.com", "billing@hostco.io",
                "no-reply@orders.shop", "support@{co}.com"],
}

DOMAINS = [c.lower().replace("&", "and").replace(" ", "") + ".com" for c in COMPANIES]


def fill(template: str) -> str:
    return (
        template
        .replace("{name}", random.choice(FIRST_NAMES))
        .replace("{last}", random.choice(LAST_NAMES))
        .replace("{company}", random.choice(COMPANIES))
        .replace("{product}", random.choice(PRODUCTS))
        .replace("{co}", random.choice(DOMAINS).removesuffix(".com"))
        .replace("{code}", str(random.randint(100000, 999999)))
        .replace("{n}", str(random.choice([3, 5, 8, 10, 12, 15, 20, 25, 40, 50, 100, 250])))
    )


def make_subject(label: str) -> str:
    if label == "lead":
        return random.choice([
            "Pricing for our team", "Quote request", "Interested in a demo",
            "Partnership opportunity", "Enterprise plan inquiry",
            "Buying your " + random.choice(PRODUCTS),
        ])
    if label == "job_alert":
        return random.choice([
            f"{random.randint(3, 30)} new jobs match your alert", "Hackathon reminder",
            "Your weekly job digest", "New competition on Kaggle",
            "Internship deadline approaching", "Google is hiring interns!",
            "Grab a PPO with Satin Finserv", "GE HealthCare internship alert",
            "Hiring challenge: registrations open",
        ])
    if label == "otp_code":
        return random.choice([
            "Your verification code", f"{random.randint(100000, 999999)} is your login code",
            "One-time security code", "Confirm your identity", "Your OTP expires soon",
        ])
    if label == "social":
        return random.choice([
            "You have new notifications", "Weekly digest from your communities",
            f"{random.choice(FIRST_NAMES)} mentioned you", "See what you missed",
            "New activity on your posts",
        ])
    if label == "newsletter":
        return random.choice([
            "This week's digest", "Monthly product updates", "What's new: September edition",
            "Top stories for your weekend", "Your publisher report is ready",
        ])
    if label == "spam":
        return random.choice([
            "YOU ARE A WINNER!!!", "Claim your prize now", "URGENT: action required",
            "80% OFF ends today", "Double your money fast",
        ])
    return random.choice([
        "Your order has shipped", "Invoice attached", "Appointment reminder",
        "Your statement is ready", "Ticket resolved", "Meeting rescheduled",
    ])


def generate_dataset():
    rows = []
    for label, count in COUNTS.items():
        for _ in range(count):
            body = fill(random.choice(CATEGORY_DATA[label]))
            rows.append({
                "sender": fill(random.choice(SENDERS[label])),
                "subject": make_subject(label),
                "body": body,
                "label": label,
                "intent": INTENT[label],
                "priority": "high" if label == "lead" else "low",
            })

    random.shuffle(rows)
    for i, r in enumerate(rows, 1):
        r["id"] = i

    fieldnames = ["id", "sender", "subject", "body", "label", "intent", "priority"]
    with open("dataset/emails.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to dataset/emails.csv at {datetime.now().isoformat(timespec='seconds')}")
    for label, count in COUNTS.items():
        print(f"  {label:12s}: {count}")


if __name__ == "__main__":
    generate_dataset()
