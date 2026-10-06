"""Smoke test: 4 crafted cases proving the tightened prompt works."""
import sys
import time

sys.path.insert(0, "app")
from llm_classifier import classify_email_llm

CASES = [
    ("ops@logisticspro.com", "Urgent: Partnership Opportunity - Middle East Distribution",
     "We would like to discuss distributing your platform in the GCC region. This partnership would be huge for both companies.",
     "normal", "partnership pitch"),
    ("talent@techrecruit.io", "Found your profile - Senior Developer role, 100% remote",
     "We are impressed by your background. Our client is hiring a senior developer and would love to talk.",
     "normal", "recruiter outreach"),
    ("growth@brightagency.com", "Quick question about your marketing",
     "We help B2B SaaS companies 3x their pipeline. Worth a quick chat next week?",
     "normal", "vendor/agency pitch"),
    ("priya@acmecorp.com", "Enterprise Software Pricing Request - 200 seats",
     "Hi, we evaluated your tool and want pricing for 200 seats this quarter. Please send a quote.",
     "lead", "real buyer (must stay LEAD)"),
]

passed = 0
for sender, subj, body, want, name in CASES:
    r = classify_email_llm(sender, subj, body)
    got = r["label"] if r else "FAILED"
    ok = got == want
    passed += ok
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: expected {want}, got {got}")
    if r:
        print(f"       reason: {r['reasoning'][:100]}")
    time.sleep(13)

print(f"\n{passed}/{len(CASES)} passed")
sys.exit(0 if passed == len(CASES) else 1)
