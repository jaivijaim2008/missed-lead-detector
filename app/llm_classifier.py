"""
llm_classifier.py
-----------------
LLM-based email classification. Replaces the old TF-IDF + Logistic
Regression model as the primary classifier; process_email.py keeps the
pickle model as a fallback in case the LLM API is unreachable, has no
key configured, or errors out.

Provider priority (first env var found wins):
    1. Groq      - GROQ_API_KEY       (OpenAI-compatible; free tier)
    2. Gemini    - GEMINI_API_KEY     (free tier available, no credit card)
    3. Anthropic - ANTHROPIC_API_KEY
    4. OpenAI    - OPENAI_API_KEY

The LLM receives the email subject + body and must answer with strict JSON:
    {"label": ..., "intent": ..., "priority": ..., "reasoning": ...}

Usage:
    from llm_classifier import classify_email_llm
    result = classify_email_llm(subject, body, sender)
    # -> {"label", "intent", "priority", "reasoning", "confidence", "model"} or None
"""

import os
import json
import re
import time

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()  # picks up PROJECT_ROOT/.env if present
except ImportError:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

DEFAULT_TIMEOUT = 25.0
MAX_RETRIES = 2  # 1 initial attempt + 2 retries on transient failures
MAX_BODY_CHARS = 6000

VALID_LABELS = {"lead", "normal", "spam"}
VALID_INTENTS = {
    "pricing/purchase",
    "meeting/demo",
    "partnership",
    "product_inquiry",
    "general",
}
VALID_PRIORITIES = {"high", "medium", "low"}

_clients = {}

# Last exception seen by classify_email_llm (e.g. a 429 with a retry hint).
# Callers that retry patiently can parse "try again in Xs" from this.
LAST_ERROR: Exception | None = None

PROVIDER_LABELS = {
    "groq": "Groq",
    "gemini": "Google Gemini",
    "anthropic": "Anthropic Claude",
    "openai": "OpenAI GPT",
}


def get_active_provider():
    """Return 'groq' | 'gemini' | 'anthropic' | 'openai' | None based on configured keys."""
    if os.environ.get("GROQ_API_KEY"):
        return "groq"
    if os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    return None


def get_provider_label():
    """Human-readable provider name, or None when no key is configured."""
    provider = get_active_provider()
    return PROVIDER_LABELS.get(provider) if provider else None


def get_model_name():
    """Model id used by the active provider (or 'none' when unconfigured)."""
    provider = get_active_provider()
    return {
        "groq": GROQ_MODEL,
        "gemini": GEMINI_MODEL,
        "anthropic": ANTHROPIC_MODEL,
        "openai": OPENAI_MODEL,
        None: "none",
    }[provider]


SYSTEM_ROLE = (
    "You are a precise email classification engine. You respond with a "
    "single valid JSON object and nothing else."
)

SYSTEM_PROMPT = """You classify emails for a sales lead-detection app. You will be given one email's sender, subject and body. Respond with ONLY a JSON object - no markdown, no explanation outside the JSON.

Schema (all fields required):
{
  "label": "lead" | "normal" | "spam",
  "intent": "pricing/purchase" | "meeting/demo" | "partnership" | "product_inquiry" | "general",
  "priority": "high" | "medium" | "low",
  "reasoning": "one short sentence"
}

Definitions:
- "lead": a human being writes to US wanting to BUY or use OUR product - asking about our product, pricing, or a demo/meeting, or replying in an ongoing sales conversation. Only real sales opportunities are leads.
- "normal": everything that is legitimately addressed to the recipient but is not a sales opportunity - including partnership proposals, vendor pitches and bulk business outreach (see below).
- "spam": unsolicited bulk advertising, scams or phishing.

IMPORTANT - these are NEVER leads, even if they sound urgent, personal, complimentary, or offer money/deals:
- Job alerts and recruiter/job-digest emails (e.g. Handshake, LinkedIn, Internshala), hiring or "we're hiring" announcements
- Recruiting / talent outreach directed AT the recipient: job offers, "we found your profile", freelance/contract gig pitches, HR agencies offering candidates
- Partnership, reseller, distributor, affiliate and integration proposals ("let's partner", "white-label your service", "distribute your platform in...") - these are vendor/business-development pitches, not customers wanting our product
- Vendor and supplier pitches selling TO us: agencies offering their marketing/dev/design services, SEO or lead-gen offers, "we can build this for you", CVs from freelancers
- Automated bulk business email: mass B2B outreach, cold sequences, company newsletters and digests, webinar/event invitations from other companies, "statement of work" / proposal blasts
- OTP / verification / security codes, password resets, login alerts, account security notices
- Social media notifications (Facebook, Instagram, Reddit, X) and friend/follower suggestions
- Product newsletters, release notes, changelogs, and product-update announcements (e.g. Ollama, Vercel, OpenAI, Google AI Studio, Groq)
- Automated marketing / promotional blasts: discounts, offers, "your plan", pricing-page promos, webinars, event invites, deal reminders (e.g. Spotify Premium offers, Adobe promos)
- Automated system/status notifications: deploy or build results (Vercel), downtime/status alerts (Razorpay, Cloudflare), API-key expiry notices (Brevo), payment-card declines, billing receipts, review/feedback requests
- Hackathon/competition/community announcements and reminders (e.g. Devpost, Kaggle)
- Automated "nurture" sequences from tools the recipient already uses (e.g. Salesforce/Slack marketing)

Classify intent for non-leads too: newsletters/product updates -> "general", promotions -> "general". For a lead choose the intent that matches: pricing questions or purchase interest -> "pricing/purchase"; demo or meeting request -> "meeting/demo"; a customer asking about features or fit -> "product_inquiry". Use "partnership" ONLY when an actual paying-customer relationship is being discussed, never for partnership/vendor proposals (those are "general").

Priority: "high" for leads ready to buy or asking for a demo/meeting; "medium" for partnership or general product interest; "low" for everything else.

Examples:

FROM: Handshake <handshake@g.joinhandshake.com>
SUBJECT: Re: Following up: JAI, Handshake AI is hiring AI Trainer (Contract)
BODY: We found this job based on your profile... 370 new AI Trainer jobs...
{"label": "normal", "intent": "general", "priority": "low", "reasoning": "Automated job alert, not a sales inquiry."}

FROM: Ollama <hello@ollama.com>
SUBJECT: Ollama's Team plan is now available
BODY: We're excited to announce our new Team plan...
{"label": "normal", "intent": "general", "priority": "low", "reasoning": "Product newsletter announcing a plan, not an inbound sales inquiry."}

FROM: Devpost <support@devpost.com>
SUBJECT: Final call for submissions - AI Builders Hackathon
BODY: Submissions close at 1:00 PM PT today...
{"label": "normal", "intent": "general", "priority": "low", "reasoning": "Hackathon reminder from Devpost, automated community email."}

FROM: Vercel <notifications@vercel.com>
SUBJECT: Failed production deployment on team 'my-team's project
BODY: Deployment failed... verify your build logs...
{"label": "normal", "intent": "general", "priority": "low", "reasoning": "Automated deployment status notification."}

FROM: Priya Sharma <priya@acmecorp.com>
SUBJECT: Enterprise Software Pricing Request - 200 seats
BODY: Hi, we evaluated your tool and want pricing for 200 seats this quarter...
{"label": "lead", "intent": "pricing/purchase", "priority": "high", "reasoning": "Prospect explicitly requests pricing for 200 seats with a timeline."}

FROM: ops@logisticspro.com
SUBJECT: Urgent: Partnership Opportunity - Middle East Distribution
BODY: We'd like to discuss distributing your platform in the GCC region...
{"label": "normal", "intent": "general", "priority": "low", "reasoning": "Distribution-partnership pitch from another company, not a customer wanting our product."}

FROM: talent@techrecruit.io
SUBJECT: Found your profile - Senior Developer role, 100% remote
BODY: We're impressed by your background. Our client is hiring...
{"label": "normal", "intent": "general", "priority": "low", "reasoning": "Recruiter outreach about a job, not a product sales inquiry."}

FROM: growth@brightagency.com
SUBJECT: Quick question about your marketing
BODY: We help B2B SaaS companies 3x their pipeline. Worth a quick chat?
{"label": "normal", "intent": "general", "priority": "low", "reasoning": "Agency selling its own services to us - a vendor pitch, not demand for our product."}

FROM: winner@lottery-intl.biz
SUBJECT: Congratulations!!! You have won $2,500,000
BODY: Send your bank details to claim your prize...
{"label": "spam", "intent": "general", "priority": "low", "reasoning": "Classic advance-fee scam."}"""

# Per-email tail is appended separately (str.format is only applied here, so
# the JSON braces in the static prompt above are never interpreted as fields).
PROMPT_TAIL = """

Now classify this email. Respond with ONLY the JSON object.

FROM: {sender}
SUBJECT: {subject}
BODY:
{body}"""


def _build_prompt(sender: str, subject: str, body: str) -> str:
    return SYSTEM_PROMPT + PROMPT_TAIL.format(
        sender=(sender or "unknown")[:200],
        subject=(subject or "(no subject)")[:300],
        body=body or "(empty body)",
    )


def _get_groq_client():
    """Groq is OpenAI-compatible: reuse the OpenAI SDK pointed at Groq's base URL."""
    if "groq" not in _clients:
        from openai import OpenAI

        _clients["groq"] = OpenAI(
            api_key=os.environ.get("GROQ_API_KEY"),
            base_url=GROQ_BASE_URL,
            timeout=DEFAULT_TIMEOUT,
            max_retries=0,
        )
    return _clients["groq"]


def _get_gemini_client():
    if "gemini" not in _clients:
        from google import genai
        from google.genai import types

        api_key = os.environ.get("GEMINI_API_KEY")
        try:
            # HttpOptions timeout is expressed in milliseconds.
            _clients["gemini"] = genai.Client(
                api_key=api_key, http_options=types.HttpOptions(timeout=25000)
            )
        except Exception:
            _clients["gemini"] = genai.Client(api_key=api_key)
    return _clients["gemini"]


def _get_anthropic_client():
    if "anthropic" not in _clients:
        from anthropic import Anthropic

        _clients["anthropic"] = Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            timeout=DEFAULT_TIMEOUT,
            max_retries=0,
        )
    return _clients["anthropic"]


def _get_openai_client():
    if "openai" not in _clients:
        from openai import OpenAI

        _clients["openai"] = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
            timeout=DEFAULT_TIMEOUT,
            max_retries=0,
        )
    return _clients["openai"]


def _call_provider(provider: str, prompt: str) -> str:
    """Send the prompt to the given provider, return the raw text reply."""
    if provider == "groq":
        client = _get_groq_client()
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0.0,
            max_tokens=300,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_ROLE},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content or ""

    if provider == "gemini":
        client = _get_gemini_client()
        from google.genai import types

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_ROLE,
                temperature=0.0,
                max_output_tokens=300,
                response_mime_type="application/json",
            ),
        )
        return response.text or ""

    if provider == "anthropic":
        client = _get_anthropic_client()
        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=300,
            temperature=0.0,
            system=SYSTEM_ROLE,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(
            block.text for block in response.content if getattr(block, "type", "") == "text"
        )

    if provider == "openai":
        client = _get_openai_client()
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0.0,
            max_tokens=300,
            messages=[
                {"role": "system", "content": SYSTEM_ROLE},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content or ""

    raise ValueError(f"unknown provider: {provider}")


def _extract_json(text: str) -> dict:
    """Pull the JSON object out of the model response, tolerating stray text or code fences."""
    text = text.strip()
    # Strip markdown fences if present
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    else:
        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end > brace_start:
            text = text[brace_start : brace_end + 1]
    return json.loads(text)


def _validate(raw: dict) -> dict:
    """Coerce the LLM's answer into the exact schema; raises ValueError if unusable."""
    label = str(raw.get("label", "")).strip().lower()
    intent = str(raw.get("intent", "")).strip().lower()
    priority = str(raw.get("priority", "")).strip().lower()
    reasoning = str(raw.get("reasoning", "")).strip()

    if label not in VALID_LABELS:
        raise ValueError(f"invalid label: {label!r}")
    if intent not in VALID_INTENTS:
        intent = "general"
    if priority not in VALID_PRIORITIES:
        priority = "low"

    return {
        "label": label,
        "intent": intent,
        "priority": priority,
        "reasoning": reasoning[:300],
    }


def classify_email_llm(sender: str, subject: str, body: str, verbose: bool = False):
    """
    Classify one email via the configured LLM provider.

    Returns a dict:
        {"label", "intent", "priority", "reasoning", "confidence", "model", "provider"}
    or None if there is no API key, the call fails/times out, or the reply
    can't be parsed into valid JSON. Callers should fall back to the local
    model when None is returned.
    """
    provider = get_active_provider()
    if provider is None:
        return None

    prompt = _build_prompt(sender, (subject or "")[:300], (body or "").strip()[:MAX_BODY_CHARS])

    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            text = _call_provider(provider, prompt)
            parsed = _validate(_extract_json(text))

            # Confidence: the UI expects a 0-100 number like the old
            # predict_proba output. The LLM gives a categorical answer, so we
            # map it onto a stable band (roughly 90-95%).
            confidence = 95.0 if parsed["label"] != "normal" else 92.0
            parsed["confidence"] = round(confidence, 1)
            parsed["model"] = get_model_name()
            parsed["provider"] = provider

            if verbose:
                print(f"  [llm] {parsed['label']}/{parsed['intent']} ({parsed['reasoning']})")
            return parsed

        except Exception as exc:  # API error, timeout, JSON parse error...
            last_error = exc
            global LAST_ERROR
            LAST_ERROR = exc
            if attempt < MAX_RETRIES:
                wait = 1.5 * (attempt + 1)
                # Rate-limit errors carry a retry hint, e.g.
                # "... Please try again in 4.2375s." — respect it.
                hint = re.search(r"try again in ([\d.]+)s", str(exc))
                if hint:
                    wait = min(float(hint.group(1)) + 1.5, 30.0)
                time.sleep(wait)

    print(f"[llm_classifier] all {MAX_RETRIES + 1} attempts failed ({provider}): {last_error}")
    return None
