import os
import sys
import re
import html
import time
import base64
import argparse
from email.utils import parsedate_to_datetime
from datetime import datetime

# Configure Windows console for UTF-8 encoding (avoids emoji crashes in subject lines)
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

# Ensure project and app root are in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from database import email_exists, create_database
from process_email import process_email
from gmail_auth import get_gmail_service


def clean_html(raw_html):
    """Strip HTML tags and unescape entities to return readable plain text."""
    if not raw_html:
        return ""
    # Remove script and style elements
    cleaned = re.sub(r"<(script|style).*?>.*?</\1>", " ", raw_html, flags=re.DOTALL | re.IGNORECASE)
    # Replace breaks and paragraphs with newlines
    cleaned = re.sub(r"<(br|p|div|tr)[^>]*>", "\n", cleaned, flags=re.IGNORECASE)
    # Remove remaining HTML tags
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    # Unescape HTML entities (&amp;, &nbsp;, etc.)
    cleaned = html.unescape(cleaned)
    # Collapse excess whitespace while preserving linebreaks
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in cleaned.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_body_from_payload(payload):
    """Recursively extract plain text body from a Gmail message payload."""
    body_text = ""
    mime_type = payload.get("mimeType", "")

    # Check for multipart
    parts = payload.get("parts", [])
    if parts:
        # First preference: look for text/plain
        for part in parts:
            part_mime = part.get("mimeType", "")
            if part_mime == "text/plain":
                data = part.get("body", {}).get("data", "")
                if data:
                    try:
                        decoded = base64.urlsafe_b64decode(data.encode("ASCII")).decode("utf-8", errors="replace")
                        body_text += decoded + "\n"
                    except Exception:
                        pass
            elif part_mime.startswith("multipart/"):
                body_text += extract_body_from_payload(part)

        # Fallback preference: if no plain text found, extract text/html
        if not body_text.strip():
            for part in parts:
                part_mime = part.get("mimeType", "")
                if part_mime == "text/html":
                    data = part.get("body", {}).get("data", "")
                    if data:
                        try:
                            decoded = base64.urlsafe_b64decode(data.encode("ASCII")).decode("utf-8", errors="replace")
                            body_text = clean_html(decoded)
                            break
                        except Exception:
                            pass
    else:
        # Single-part message
        data = payload.get("body", {}).get("data", "")
        if data:
            try:
                decoded = base64.urlsafe_b64decode(data.encode("ASCII")).decode("utf-8", errors="replace")
                if mime_type == "text/html":
                    body_text = clean_html(decoded)
                else:
                    body_text = decoded
            except Exception:
                pass

    return body_text.strip()


def get_header(headers, header_name, default=""):
    """Case-insensitive header lookup."""
    target = header_name.lower()
    for h in headers:
        if h.get("name", "").lower() == target:
            return h.get("value", default)
    return default


def parse_email_date(date_str):
    """Parse email RFC 2822 date to ISO 8601 string."""
    if not date_str:
        return datetime.now().isoformat()
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.isoformat()
    except Exception:
        return datetime.now().isoformat()


def fetch_and_process_emails(max_results=10, query="label:INBOX", unread_only=False, force=False, progress_callback=None):
    """
    Connect to Gmail, fetch recent/unread emails, check duplicates,
    and process each through the ML classifier.
    """
    create_database()

    search_query = query
    if unread_only and "is:unread" not in search_query:
        search_query = f"{search_query} is:unread".strip()

    print("\n" + "=" * 50)
    print("GMAIL INBOX SYNC")
    print("=" * 50)
    print(f"Connecting to Gmail API...")
    service = get_gmail_service()
    print(f"Query: '{search_query}' | Max results: {max_results}")

    if progress_callback:
        progress_callback(0, max_results, "Connecting to Gmail API...")

    # List messages matching query — with pagination to exceed 100-per-page limit
    messages = []
    page_token = None
    page_num = 0

    while len(messages) < max_results:
        page_num += 1
        batch_size = min(100, max_results - len(messages))  # Gmail caps at 100 per page

        request_kwargs = {
            "userId": "me",
            "q": search_query,
            "maxResults": batch_size,
        }
        if page_token:
            request_kwargs["pageToken"] = page_token

        response = service.users().messages().list(**request_kwargs).execute()

        batch = response.get("messages", [])
        if not batch:
            break

        messages.extend(batch)
        print(f"  Page {page_num}: fetched {len(batch)} message IDs (total so far: {len(messages)})")
        if progress_callback:
            progress_callback(len(messages), max_results, f"Discovered {len(messages)} messages...")

        page_token = response.get("nextPageToken")
        if not page_token:
            break  # No more pages

    if not messages:
        print("\nNo messages matched the query.")
        if progress_callback:
            progress_callback(0, 0, "No emails matched the query.")
        return []

    print(f"\nFound {len(messages)} matching email(s). Processing...\n")

    stats = {
        "total": len(messages),
        "skipped": 0,
        "processed": 0,
        "leads": 0,
        "spam": 0,
        "general": 0,
        "high_priority_leads": 0
    }

    processed_results = []

    for idx, msg_meta in enumerate(messages, 1):
        msg_id = msg_meta["id"]

        # Check if already processed
        if not force and email_exists(msg_id):
            print(f"[{idx}/{len(messages)}] Skipping already processed message (ID: {msg_id})")
            stats["skipped"] += 1
            if progress_callback and idx % 5 == 0:
                progress_callback(idx, len(messages), f"Checking message {idx}/{len(messages)} (skipped existing)...")
            continue

        # Small delay between message fetches to respect Gmail API quotas
        time.sleep(0.06)

        msg = None
        for attempt in range(3):
            try:
                msg = service.users().messages().get(
                    userId="me",
                    id=msg_id,
                    format="full"
                ).execute()
                break
            except Exception as e:
                err_text = str(e)
                if ("rateLimitExceeded" in err_text or "Quota exceeded" in err_text or "429" in err_text or "403" in err_text) and attempt < 2:
                    backoff = (2 ** attempt) + 1.0
                    print(f"[{idx}/{len(messages)}] Rate limit hit for {msg_id}. Retrying in {backoff:.1f}s...")
                    time.sleep(backoff)
                else:
                    print(f"[{idx}/{len(messages)}] Error fetching message {msg_id}: {e}")
                    break

        if not msg:
            continue

        payload = msg.get("payload", {})
        headers = payload.get("headers", [])

        sender = get_header(headers, "From", "Unknown Sender")
        subject = get_header(headers, "Subject", "(No Subject)")
        raw_date = get_header(headers, "Date", "")
        received_at = parse_email_date(raw_date)

        body = extract_body_from_payload(payload)
        if not body:
            # Fallback to snippet if body extraction yielded nothing
            body = msg.get("snippet", "")

        print(f"[{idx}/{len(messages)}] Processing: \"{subject}\" from {sender}")

        # Run ML classification and database save
        result = process_email(
            sender=sender,
            subject=subject,
            body=body,
            received_at=received_at,
            message_id=msg_id,
            verbose=False
        )

        stats["processed"] += 1
        label = result.get("label", result.get("prediction", "general"))
        priority = result.get("priority", "low")

        if label == "lead":
            stats["leads"] += 1
            if priority == "high":
                stats["high_priority_leads"] += 1
        elif label == "spam":
            stats["spam"] += 1
        else:
            stats["general"] += 1

        print(f"       -> Predicted: [{label.upper()}] | Confidence: {result['confidence']:.1f}% | Intent: {result['intent']} | Priority: {priority.upper()}")
        processed_results.append(result)

        if progress_callback:
            progress_callback(idx, len(messages), f"Processed {idx}/{len(messages)} emails ({stats['leads']} leads found)")

    print("\n" + "=" * 50)
    print("SYNC SUMMARY")
    print("=" * 50)
    print(f"Total Emails Inspected: {stats['total']}")
    print(f"Skipped (Already Processed): {stats['skipped']}")
    print(f"Newly Processed: {stats['processed']}")
    print(f"  - Leads: {stats['leads']} (High Priority: {stats['high_priority_leads']})")
    print(f"  - General: {stats['general']}")
    print(f"  - Spam: {stats['spam']}")
    print("=" * 50)

    return processed_results


def main():
    parser = argparse.ArgumentParser(description="Fetch emails from Gmail and classify with ML lead detector.")
    parser.add_argument("--max-results", "-m", type=int, default=10, help="Max emails to fetch (default: 10)")
    parser.add_argument("--query", "-q", type=str, default="label:INBOX", help="Gmail search query (default: 'label:INBOX')")
    parser.add_argument("--unread", "-u", action="store_true", help="Only fetch unread emails")
    parser.add_argument("--force", "-f", action="store_true", help="Re-process emails even if already in database")

    args = parser.parse_args()

    fetch_and_process_emails(
        max_results=args.max_results,
        query=args.query,
        unread_only=args.unread,
        force=args.force
    )


if __name__ == "__main__":
    main()
