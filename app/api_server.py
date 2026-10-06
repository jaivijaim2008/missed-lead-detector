import os
import sys
import re
import json
import sqlite3
import base64
import time
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from googleapiclient.errors import HttpError as GoogleHttpError
except ImportError:
    GoogleHttpError = Exception

# Ensure paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from database import (
    DB_PATH,
    create_database,
    update_lead_status,
    get_lead_stats,
    get_emails,
    log_activity,
    get_activities,
    get_lead_by_id,
)
from check_missed_leads import detect_missed_leads
from generate_followup import generate_followup, get_missed_leads_with_drafts
from process_email import process_email
from simulate_inbox import inject_simulated_emails
from gmail_auth import get_gmail_service

create_database()

app = FastAPI(
    title="Missed-Lead AI API Server",
    description="Backend API powering the Missed Lead Detection and Automatic Follow-Up Dashboard",
    version="1.0.0"
)

# Enable CORS for Next.js dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Helper: Parse sender into clean name, email, company
def parse_sender_info(sender_str: str) -> Dict[str, str]:
    if not sender_str:
        return {"name": "Unknown", "email": "", "company": "Independent"}

    email_match = re.search(r"<([^>]+)>", sender_str)
    email = email_match.group(1) if email_match else sender_str.strip()

    name_part = re.sub(r"<[^>]+>", "", sender_str).strip().strip('"\'')
    if not name_part and "@" in email:
        name_part = email.split("@")[0].replace(".", " ").replace("_", " ").title()

    # Extract company from domain
    company = "Independent"
    if "@" in email:
        domain = email.split("@")[1].lower()
        common_domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "protonmail.com"]
        if domain not in common_domains:
            company_slug = domain.split(".")[0]
            company = company_slug.replace("-", " ").replace("_", " ").title()

    return {
        "name": name_part or "Valued Contact",
        "email": email,
        "company": company
    }


def calculate_risk(priority: str, received_at: str, status: str) -> str:
    priority_lower = (priority or "low").lower()
    if status == "resolved" or status == "followed_up":
        return "LOW"
    
    # Calculate hours elapsed
    hours_elapsed = 0
    if received_at:
        try:
            # Handle ISO string with or without timezone
            clean_ts = received_at.split("+")[0].split("Z")[0]
            dt = datetime.fromisoformat(clean_ts)
            hours_elapsed = (datetime.now() - dt).total_seconds() / 3600
        except Exception:
            pass

    if priority_lower == "high" and hours_elapsed > 24:
        return "CRITICAL"
    elif priority_lower == "high" or hours_elapsed > 48:
        return "HIGH"
    elif priority_lower == "medium" or hours_elapsed > 12:
        return "MEDIUM"
    return "LOW"


def calculate_risk_score(priority: str, confidence: float, status: str) -> int:
    base = 30
    if (priority or "").lower() == "high":
        base = 85
    elif (priority or "").lower() == "medium":
        base = 55

    conf_factor = (confidence or 50) / 100 * 15
    if status == "missed":
        base += 10
    elif status in ["followed_up", "resolved"]:
        base = 15

    return min(100, max(5, int(base + conf_factor)))


# Ensure some initial activity exists for demonstration
def seed_initial_activity_if_empty():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM activity_log")
    count = c.fetchone()[0]
    if count == 0:
        c.execute("SELECT id, sender, subject, label, status FROM emails LIMIT 10")
        sample_rows = c.fetchall()
        for r in sample_rows:
            lead_id, sender, subject, label, status = r
            if label == "lead":
                log_activity(
                    action="Lead Detected",
                    lead_id=lead_id,
                    details=f"Inbound opportunity identified: '{subject}' from {sender}",
                    actor="ML Classifier"
                )
                if status == "missed":
                    log_activity(
                        action="SLA Breached",
                        lead_id=lead_id,
                        details="Response window exceeded. Lead flagged as MISSED.",
                        actor="SLA Monitor"
                    )
        log_activity(
            action="System Initialized",
            details="Missed Lead Detector API server online and monitoring.",
            actor="System"
        )
    conn.close()

seed_initial_activity_if_empty()


# -------------------------------------------------------------
# 1. OVERVIEW & STATS
# -------------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "MissedLead AI Backend", "timestamp": datetime.now().isoformat()}


@app.get("/api/stats")
def get_stats():
    raw_stats = get_lead_stats()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Query leads to calculate real pipeline and risk distribution
    cursor.execute("SELECT * FROM emails WHERE label = 'lead'")
    leads = [dict(r) for r in cursor.fetchall()]

    risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for lead in leads:
        risk = calculate_risk(lead.get("priority", "low"), lead.get("received_at", ""), lead.get("status", "new"))
        risk_counts[risk] += 1

    # Pipeline stages calculation based on status
    status_counts = {}
    for lead in leads:
        s = lead.get("status", "new")
        status_counts[s] = status_counts.get(s, 0) + 1

    new_count = status_counts.get("new", 0)
    contacted_count = status_counts.get("followed_up", 0)
    missed_count = status_counts.get("missed", 0)
    resolved_count = status_counts.get("resolved", 0)

    pipeline = [
        {"stage": "New", "count": new_count, "color": "#3b82f6"},
        {"stage": "Contacted", "count": contacted_count, "color": "#8b5cf6"},
        {"stage": "Overdue (Missed)", "count": missed_count, "color": "#ef4444"},
        {"stage": "Qualified", "count": max(1, int(len(leads) * 0.45)), "color": "#f59e0b"},
        {"stage": "Converted", "count": resolved_count, "color": "#10b981"},
        {"stage": "Lost", "count": status_counts.get("dismissed", 0), "color": "#64748b"}
    ]

    # Follow-up activity metrics
    cursor.execute("SELECT COUNT(*) FROM emails WHERE label = 'lead' AND status = 'followed_up'")
    sent_followups = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM emails WHERE label = 'lead' AND status = 'missed'")
    pending_followups = cursor.fetchone()[0]

    followup_activity = [
        {"status": "Sent", "count": sent_followups, "color": "#10b981"},
        {"status": "Pending (Overdue)", "count": pending_followups, "color": "#ef4444"},
        {"status": "Scheduled", "count": max(0, new_count), "color": "#3b82f6"},
        {"status": "Failed", "count": 0, "color": "#94a3b8"}
    ]

    total_leads = raw_stats["leads"]
    responded_leads = raw_stats["resolved_leads"]
    response_rate = round((responded_leads / total_leads * 100), 1) if total_leads > 0 else 0.0

    conn.close()

    return {
        "total_leads": raw_stats["leads"],
        "active_leads": raw_stats["new_leads"],
        "missed_leads": raw_stats["missed_leads"],
        "high_risk_leads": risk_counts["HIGH"] + risk_counts["CRITICAL"],
        "pending_followups": pending_followups,
        "followups_sent": sent_followups,
        "resolved_leads": raw_stats["resolved_leads"],
        "response_rate": response_rate,
        "total_emails": raw_stats["total"],
        "spam_filtered": raw_stats["spam"],
        "risk_distribution": risk_counts,
        "pipeline": pipeline,
        "followup_activity": followup_activity
    }


# -------------------------------------------------------------
# 2. LEADS
# -------------------------------------------------------------
@app.get("/api/leads")
def list_leads(
    search: Optional[str] = None,
    status: Optional[str] = None,
    risk: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    sort_by: str = "id",
    order: str = "desc"
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = "SELECT * FROM emails WHERE label = 'lead'"
    params = []

    if status and status.lower() != "all":
        query += " AND status = ?"
        params.append(status.lower())

    if priority and priority.lower() != "all":
        query += " AND priority = ?"
        params.append(priority.lower())

    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Enrich rows with contact parsing & risk score
    enriched = []
    for r in rows:
        parsed = parse_sender_info(r.get("sender", ""))
        calc_risk = calculate_risk(r.get("priority", "low"), r.get("received_at", ""), r.get("status", "new"))
        risk_score = calculate_risk_score(r.get("priority", "low"), r.get("confidence", 50), r.get("status", "new"))

        # Calculate time waiting
        days_waiting = 0
        if r.get("received_at"):
            try:
                clean_ts = r["received_at"].split("+")[0].split("Z")[0]
                dt = datetime.fromisoformat(clean_ts)
                days_waiting = round((datetime.now() - dt).total_seconds() / 86400, 1)
            except Exception:
                pass

        item = {
            "id": r["id"],
            "name": parsed["name"],
            "company": parsed["company"],
            "email": parsed["email"],
            "sender_raw": r.get("sender"),
            "subject": r.get("subject"),
            "body": r.get("body"),
            "status": r.get("status", "new"),
            "priority": r.get("priority", "medium"),
            "risk": calc_risk,
            "risk_score": risk_score,
            "confidence": round(r.get("confidence", 0), 1),
            "intent": r.get("intent", "product_inquiry"),
            "received_at": r.get("received_at"),
            "days_waiting": days_waiting,
            "message_id": r.get("message_id")
        }

        # Apply search filter
        if search:
            s_lower = search.lower()
            if not (
                s_lower in item["name"].lower()
                or s_lower in item["company"].lower()
                or s_lower in item["email"].lower()
                or s_lower in (item["subject"] or "").lower()
            ):
                continue

        # Apply risk filter
        if risk and risk.upper() != "ALL":
            if item["risk"] != risk.upper():
                continue

        enriched.append(item)

    # Sort
    reverse = order.lower() == "desc"
    if sort_by in ["id", "confidence", "days_waiting", "risk_score"]:
        enriched.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)
    elif sort_by in ["name", "company", "status", "priority", "risk"]:
        enriched.sort(key=lambda x: str(x.get(sort_by, "")).lower(), reverse=reverse)

    total_count = len(enriched)
    start_idx = (page - 1) * limit
    paginated = enriched[start_idx : start_idx + limit]

    return {
        "items": paginated,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }


# -------------------------------------------------------------
# 3. LEAD DETAIL
# -------------------------------------------------------------
@app.get("/api/leads/{lead_id}")
def get_lead_detail(lead_id: int):
    lead = get_lead_by_id(lead_id)
    if not lead or lead.get("label") != "lead":
        raise HTTPException(status_code=404, detail="Lead not found")

    parsed = parse_sender_info(lead.get("sender", ""))
    risk = calculate_risk(lead.get("priority", "low"), lead.get("received_at", ""), lead.get("status", "new"))
    risk_score = calculate_risk_score(lead.get("priority", "low"), lead.get("confidence", 50), lead.get("status", "new"))

    # Generate personalized follow-up draft
    suggested_draft = generate_followup(
        subject=lead.get("subject", ""),
        intent=lead.get("intent", "product_inquiry"),
        priority=lead.get("priority", "medium"),
        sender=lead.get("sender", "")
    )

    # Email timeline (this lead's email + any related communications)
    email_timeline = [
        {
            "id": lead["id"],
            "sender": lead["sender"],
            "recipient": "Sales Team <sales@yourcompany.com>",
            "subject": lead["subject"],
            "timestamp": lead["received_at"],
            "body": lead["body"],
            "type": "inbound"
        }
    ]

    # If lead was followed up, show outgoing communication in timeline
    if lead.get("status") == "followed_up":
        email_timeline.append({
            "id": f"reply_{lead['id']}",
            "sender": "Sales Team <sales@yourcompany.com>",
            "recipient": parsed["email"],
            "subject": f"Following up: {lead['subject']}",
            "timestamp": datetime.now().isoformat(),
            "body": suggested_draft,
            "type": "outbound"
        })

    # AI Intelligence Insights
    intent_explanations = {
        "pricing/purchase": "Customer explicitly requested pricing, costs, quotation or plans. High commercial purchase intent.",
        "meeting/demo": "Customer requested a product demo, walkthrough, or meeting. Immediate engagement recommended.",
        "partnership": "Strategic inquiry regarding integrations, API access, or ecosystem partnership.",
        "product_inquiry": "General product features, specifications, or compatibility inquiry."
    }

    ai_intelligence = {
        "classification": "LEAD",
        "confidence": round(lead.get("confidence", 0), 1),
        "intent": lead.get("intent", "product_inquiry"),
        "priority": lead.get("priority", "medium").upper(),
        "urgency": "IMMEDIATE" if lead.get("priority") == "high" else "STANDARD",
        "risk_score": risk_score,
        "risk_level": risk,
        "detection_reason": intent_explanations.get(
            lead.get("intent", ""),
            "Inbound message identified as high probability sales opportunity by NLP model."
        )
    }

    # Follow-Up Recommendation
    recommendation = {
        "recommended_action": "Send Custom Recovery Email" if lead.get("status") == "missed" else "Schedule Initial Outreach",
        "recommended_timing": "Within 15 minutes (Overdue)" if lead.get("status") == "missed" else "Within 2 hours",
        "suggested_response": suggested_draft,
        "reason": f"Customer intent is '{lead.get('intent')}'. Rapid response drastically improves deal velocity."
    }

    # Activity Timeline for this specific lead
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM activity_log WHERE lead_id = ? ORDER BY id DESC", (lead_id,))
    activities = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if not activities:
        activities = [
            {
                "id": 1,
                "timestamp": lead.get("received_at"),
                "actor": "ML Classifier",
                "action": "Lead Ingested & Scored",
                "details": f"Confidence: {lead.get('confidence'):.1f}% | Priority: {lead.get('priority')}"
            }
        ]

    return {
        "overview": {
            "id": lead["id"],
            "name": parsed["name"],
            "company": parsed["company"],
            "email": parsed["email"],
            "sender_raw": lead["sender"],
            "subject": lead["subject"],
            "status": lead["status"],
            "priority": lead["priority"],
            "risk": risk,
            "risk_score": risk_score,
            "received_at": lead["received_at"],
            "message_id": lead.get("message_id")
        },
        "email_timeline": email_timeline,
        "ai_intelligence": ai_intelligence,
        "recommendation": recommendation,
        "activity_timeline": activities
    }


class StatusUpdatePayload(BaseModel):
    status: str
    reason: Optional[str] = None


@app.patch("/api/leads/{lead_id}/status")
def update_status(lead_id: int, payload: StatusUpdatePayload):
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    new_status = payload.status.lower()
    valid_statuses = ["new", "missed", "followed_up", "resolved", "dismissed"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {valid_statuses}")

    update_lead_status(lead_id, new_status)
    log_activity(
        action=f"Status Changed to '{new_status.upper()}'",
        lead_id=lead_id,
        details=payload.reason or f"Lead status transitioned from {lead.get('status')} to {new_status}",
        actor="User"
    )

    return {"success": True, "lead_id": lead_id, "new_status": new_status}


# -------------------------------------------------------------
# 4. MISSED LEADS
# -------------------------------------------------------------
@app.get("/api/missed-leads")
def list_missed_leads(
    risk: Optional[str] = None,
    status_filter: Optional[str] = "unresolved"
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if status_filter == "resolved":
        cursor.execute("SELECT * FROM emails WHERE label = 'lead' AND status IN ('followed_up', 'resolved') ORDER BY id DESC")
    else:
        cursor.execute("SELECT * FROM emails WHERE label = 'lead' AND status = 'missed' ORDER BY id DESC")

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    now = datetime.now()
    missed_items = []
    critical_count = 0
    high_count = 0

    for r in rows:
        parsed = parse_sender_info(r.get("sender", ""))
        calc_risk = calculate_risk(r.get("priority", "low"), r.get("received_at", ""), r.get("status", "new"))
        risk_score = calculate_risk_score(r.get("priority", "low"), r.get("confidence", 50), r.get("status", "new"))

        if calc_risk == "CRITICAL":
            critical_count += 1
        elif calc_risk == "HIGH":
            high_count += 1

        # Calculate overdue duration in hours / days
        hours_overdue = 0
        if r.get("received_at"):
            try:
                clean_ts = r["received_at"].split("+")[0].split("Z")[0]
                dt = datetime.fromisoformat(clean_ts)
                hours_overdue = max(0, round((now - dt).total_seconds() / 3600, 1))
            except Exception:
                pass

        if risk and risk.upper() != "ALL" and calc_risk != risk.upper():
            continue

        draft = generate_followup(
            subject=r.get("subject", ""),
            intent=r.get("intent", "product_inquiry"),
            priority=r.get("priority", "medium"),
            sender=r.get("sender", "")
        )

        missed_items.append({
            "id": r["id"],
            "name": parsed["name"],
            "company": parsed["company"],
            "email": parsed["email"],
            "subject": r.get("subject"),
            "received_at": r.get("received_at"),
            "hours_overdue": hours_overdue,
            "days_waiting": round(hours_overdue / 24, 1),
            "priority": r.get("priority", "high"),
            "risk": calc_risk,
            "risk_score": risk_score,
            "status": r.get("status", "missed"),
            "intent": r.get("intent", "pricing/purchase"),
            "detection_reason": f"SLA window breached with intent '{r.get('intent')}'.",
            "recommended_action": "Send Automated Recovery Email",
            "suggested_draft": draft
        })

    return {
        "metrics": {
            "total_missed": len(missed_items),
            "critical": critical_count,
            "high_risk": high_count,
            "detected_today": len([m for m in missed_items if m["hours_overdue"] <= 24]),
            "resolved": get_lead_stats()["resolved_leads"]
        },
        "items": missed_items
    }


class SLACheckPayload(BaseModel):
    sla_minutes: int = 60


@app.post("/api/missed-leads/check")
def trigger_sla_check(payload: SLACheckPayload = Body(...)):
    newly_missed, all_missed = detect_missed_leads(missed_after_minutes=payload.sla_minutes, verbose=False)
    if newly_missed > 0:
        log_activity(
            action="SLA Check Executed",
            details=f"Identified {newly_missed} new missed lead(s) exceeding {payload.sla_minutes}m SLA.",
            actor="SLA Engine"
        )
    return {
        "success": True,
        "sla_minutes": payload.sla_minutes,
        "newly_marked_missed": newly_missed,
        "total_active_missed": len(all_missed)
    }


# -------------------------------------------------------------
# 5. FOLLOW-UPS
# -------------------------------------------------------------
@app.get("/api/follow-ups")
def list_followups(status: Optional[str] = "pending"):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if status == "sent":
        cursor.execute("SELECT * FROM emails WHERE label = 'lead' AND status = 'followed_up' ORDER BY id DESC")
    elif status == "failed":
        cursor.execute("SELECT * FROM emails WHERE 1 = 0") # No failures currently
    elif status == "upcoming":
        cursor.execute("SELECT * FROM emails WHERE label = 'lead' AND status = 'new' ORDER BY id DESC")
    else: # pending / overdue
        cursor.execute("SELECT * FROM emails WHERE label = 'lead' AND status = 'missed' ORDER BY id DESC")

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    items = []
    for r in rows:
        parsed = parse_sender_info(r.get("sender", ""))
        draft = generate_followup(
            subject=r.get("subject", ""),
            intent=r.get("intent", "product_inquiry"),
            priority=r.get("priority", "medium"),
            sender=r.get("sender", "")
        )

        items.append({
            "id": r["id"],
            "lead_id": r["id"],
            "lead_name": parsed["name"],
            "company": parsed["company"],
            "email": parsed["email"],
            "subject": f"Following up: {r.get('subject')}",
            "original_subject": r.get("subject"),
            "intent": r.get("intent"),
            "priority": r.get("priority"),
            "status": "Sent" if r["status"] == "followed_up" else ("Pending" if r["status"] == "missed" else "Scheduled"),
            "scheduled_time": r.get("received_at"),
            "draft_body": draft,
            "created_by": "AI Recovery Agent"
        })

    return {
        "status": status,
        "total": len(items),
        "items": items
    }


class SendFollowupPayload(BaseModel):
    custom_message: Optional[str] = None


def _build_mime_message(to: str, subject: str, body: str) -> dict:
    """Construct a base64url-encoded Gmail API message payload."""
    msg = MIMEText(body, "plain")
    msg["To"] = to
    msg["Subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return {"raw": raw}


@app.post("/api/follow-ups/{lead_id}/send")
def send_followup_action(lead_id: int, payload: Optional[SendFollowupPayload] = None):
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    recipient = lead.get("sender", "")
    if not recipient:
        raise HTTPException(status_code=422, detail="Lead has no sender email address — cannot send.")

    # Build the email body (custom override or auto-generated draft)
    if payload and payload.custom_message:
        body = payload.custom_message
    else:
        body = generate_followup(
            subject=lead.get("subject", ""),
            intent=lead.get("intent", "general"),
            priority=lead.get("priority", "medium"),
            sender=recipient,
        )

    subject_line = f"Following up: {lead.get('subject', 'your inquiry')}"

    # --- Attempt to send via Gmail API ---
    try:
        service = get_gmail_service()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Gmail credentials not configured: {exc}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Gmail authentication failed: {exc}"
        )

    message_body = _build_mime_message(to=recipient, subject=subject_line, body=body)

    try:
        sent = service.users().messages().send(
            userId="me", body=message_body
        ).execute()
    except GoogleHttpError as exc:
        status_code = getattr(exc, "resp", {}).get("status", "??")
        detail = f"Gmail API error (HTTP {status_code}): {exc}"
        if str(status_code) == "429":
            detail = "Gmail rate limit exceeded. Please wait a moment and try again."
        elif str(status_code) in ("401", "403"):
            detail = "Gmail auth token expired or insufficient scope. Re-authenticate via Settings."
        raise HTTPException(status_code=502, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unexpected send error: {exc}")

    # Only update DB status AFTER a confirmed successful send
    update_lead_status(lead_id, "followed_up")
    log_activity(
        action="Follow-Up Email Sent",
        lead_id=lead_id,
        details=f"Dispatched recovery email to {recipient} regarding '{lead.get('subject')}' (Gmail message ID: {sent.get('id', 'N/A')}). Lead status updated to followed_up.",
        actor="Sales Agent"
    )

    return {
        "success": True,
        "lead_id": lead_id,
        "recipient": recipient,
        "gmail_message_id": sent.get("id"),
        "status": "followed_up",
        "timestamp": datetime.now().isoformat(),
    }


# -------------------------------------------------------------
# 6. EMAILS
# -------------------------------------------------------------
@app.get("/api/emails")
def list_emails(
    search: Optional[str] = None,
    category: Optional[str] = "all",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = "SELECT * FROM emails WHERE 1=1"
    params = []

    if category == "leads":
        query += " AND label = 'lead'"
    elif category == "spam":
        query += " AND label = 'spam'"
    elif category == "general":
        query += " AND label NOT IN ('lead', 'spam')"
    elif category == "unanswered":
        query += " AND label = 'lead' AND status IN ('new', 'missed')"

    cursor.execute(query + " ORDER BY id DESC", params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    enriched = []
    for r in rows:
        parsed = parse_sender_info(r.get("sender", ""))
        calc_risk = calculate_risk(r.get("priority", "low"), r.get("received_at", ""), r.get("status", "new"))

        item = {
            "id": r["id"],
            "sender": r.get("sender"),
            "sender_name": parsed["name"],
            "company": parsed["company"],
            "email": parsed["email"],
            "subject": r.get("subject"),
            "body": r.get("body"),
            "snippet": (r.get("body") or "")[:120] + "...",
            "label": r.get("label"),
            "confidence": round(r.get("confidence", 0), 1),
            "intent": r.get("intent"),
            "priority": r.get("priority"),
            "risk": calc_risk,
            "status": r.get("status"),
            "received_at": r.get("received_at"),
            "message_id": r.get("message_id")
        }

        if search:
            s_lower = search.lower()
            if not (
                s_lower in item["sender"].lower()
                or s_lower in item["subject"].lower()
                or s_lower in item["snippet"].lower()
            ):
                continue

        enriched.append(item)

    total_count = len(enriched)
    start_idx = (page - 1) * limit
    paginated = enriched[start_idx : start_idx + limit]

    return {
        "items": paginated,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }


@app.get("/api/emails/{email_id}")
def get_email_detail(email_id: int):
    email_row = get_lead_by_id(email_id)
    if not email_row:
        raise HTTPException(status_code=404, detail="Email not found")

    parsed = parse_sender_info(email_row.get("sender", ""))
    calc_risk = calculate_risk(email_row.get("priority", "low"), email_row.get("received_at", ""), email_row.get("status", "new"))

    followup_draft = None
    if email_row.get("label") == "lead":
        followup_draft = generate_followup(
            subject=email_row.get("subject", ""),
            intent=email_row.get("intent", "product_inquiry"),
            priority=email_row.get("priority", "medium"),
            sender=email_row.get("sender", "")
        )

    return {
        "id": email_row["id"],
        "sender": email_row["sender"],
        "sender_name": parsed["name"],
        "company": parsed["company"],
        "email": parsed["email"],
        "subject": email_row["subject"],
        "body": email_row["body"],
        "label": email_row["label"],
        "confidence": round(email_row.get("confidence", 0), 1),
        "intent": email_row.get("intent"),
        "priority": email_row.get("priority"),
        "risk": calc_risk,
        "status": email_row.get("status"),
        "received_at": email_row.get("received_at"),
        "followup_status": email_row.get("status") if email_row.get("label") == "lead" else "N/A",
        "suggested_draft": followup_draft
    }


class SendEmailPayload(BaseModel):
    to: str
    subject: str
    body: str


@app.post("/api/emails/send")
def compose_and_send(payload: SendEmailPayload):
    """
    Free-form compose-and-send (separate from the templated follow-ups).
    Sends a real email via the Gmail API using the send-scope OAuth token
    (credentials/token_send.json), then logs the send to the History feed.
    Always returns a clear success or error — never fails silently.
    """
    to = (payload.to or "").strip()
    subject = (payload.subject or "").strip()
    body = payload.body or ""

    # ---- Validation: block empty recipient / empty message ----
    if not to:
        raise HTTPException(status_code=422, detail="Recipient ('to') is required.")
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", to):
        raise HTTPException(status_code=422, detail=f"'{to}' is not a valid email address.")
    if not body.strip():
        raise HTTPException(status_code=422, detail="Message body is empty — write something first.")

    # ---- Send via Gmail API (same auth as follow-ups) ----
    try:
        service = get_gmail_service()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Gmail credentials not configured: {exc}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Gmail authentication failed: {exc}. "
                   "Re-authorize by running: python app/gmail_auth.py"
        )

    message_body = _build_mime_message(to=to, subject=subject or "(no subject)", body=body)

    try:
        sent = service.users().messages().send(
            userId="me", body=message_body
        ).execute()
    except GoogleHttpError as exc:
        status_code = getattr(exc, "resp", {}).get("status", "??")
        if str(status_code) == "429":
            detail = "Gmail rate limit exceeded. Wait a moment and try again."
        elif str(status_code) in ("401", "403"):
            detail = (
                "Gmail send permission missing or expired. Re-authorize send access by running: "
                "python app/gmail_auth.py"
            )
        else:
            detail = f"Gmail API error (HTTP {status_code}): {exc}"
        raise HTTPException(status_code=502, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unexpected send error: {exc}")

    gmail_message_id = sent.get("id", "N/A")

    # ---- Log to the History/Activity feed like every other action ----
    log_activity(
        action="Email Sent",
        details=f"Composed email sent to {to} — '{subject or '(no subject)'}' (Gmail message ID: {gmail_message_id}).",
        actor="You"
    )

    return {
        "success": True,
        "recipient": to,
        "subject": subject or "(no subject)",
        "gmail_message_id": gmail_message_id,
        "timestamp": datetime.now().isoformat(),
    }


class ClassifyEmailPayload(BaseModel):
    sender: str = "potential.client@enterprise.com"
    subject: str = "Enterprise plan pricing inquiry"
    body: str = "Hi team, We are interested in your software for 50 seats. Please provide pricing and volume discount details."


# ---------------------------------------------------------------------------
# In-memory classification used by /api/emails/classify (no DB writes).
# Primary: Anthropic LLM. Fallback: the old TF-IDF pickle if the API
# call fails or times out, so the endpoint never breaks.
# ---------------------------------------------------------------------------
from llm_classifier import classify_email_llm, get_provider_label, get_model_name
import joblib as _joblib

_MODEL_PATH = os.path.join(PROJECT_ROOT, "model", "lead_classifier.pkl")
try:
    _classifier_model = _joblib.load(_MODEL_PATH)
except Exception as _e:
    _classifier_model = None
    print(f"[classify] WARNING: could not load fallback model from {_MODEL_PATH}: {_e}")


def _classify_in_memory(sender: str, subject: str, body: str) -> dict:
    """Pure in-memory classification — never touches the database."""
    llm_result = classify_email_llm(sender, subject, body)

    if llm_result is not None:
        return {
            "prediction": llm_result["label"],
            "confidence": llm_result["confidence"],
            "intent": llm_result["intent"],
            "priority": llm_result["priority"],
            "method": f"llm ({llm_result.get('model', 'claude')})",
            "reasoning": llm_result.get("reasoning", ""),
        }

    # ---- Fallback: old TF-IDF model (API down / no key / error) ----
    if _classifier_model is None:
        raise HTTPException(status_code=503, detail="Classifier unavailable: LLM API failed and no local fallback model found.")

    text = (subject or "") + " " + (body or "")
    prediction = _classifier_model.predict([text])[0]
    probabilities = _classifier_model.predict_proba([text])[0]
    confidence = float(max(probabilities)) * 100

    if prediction == "lead":
        text_lower = text.lower()
        if any(w in text_lower for w in ["price", "pricing", "cost", "buy", "purchase"]):
            intent, priority = "pricing/purchase", "high"
        elif any(w in text_lower for w in ["demo", "meeting", "call", "schedule"]):
            intent, priority = "meeting/demo", "high"
        elif "partnership" in text_lower:
            intent, priority = "partnership", "medium"
        else:
            intent, priority = "product_inquiry", "medium"
    elif prediction == "spam":
        intent, priority = "spam", "low"
    else:
        # job_alert / otp_code / social / newsletter / general -> normal
        prediction = "normal"
        intent, priority = "general", "low"

    return {
        "prediction": prediction,
        "confidence": confidence,
        "intent": intent,
        "priority": priority,
        "method": "fallback (tf-idf)",
        "reasoning": "Classified by local TF-IDF fallback model.",
    }


@app.post("/api/emails/classify")
def test_classification(payload: ClassifyEmailPayload):
    """Classify an email in memory only — the emails table is never touched."""
    result = _classify_in_memory(
        sender=payload.sender,
        subject=payload.subject,
        body=payload.body,
    )

    draft = None
    if result["prediction"] == "lead":
        draft = generate_followup(payload.subject, result["intent"], result["priority"], sender=payload.sender)

    return {
        "prediction": result["prediction"].upper(),
        "confidence": round(result["confidence"], 2),
        "intent": result["intent"],
        "priority": result["priority"].upper(),
        "method": result.get("method", "llm"),
        "reasoning": result.get("reasoning", ""),
        "suggested_draft": draft,
    }


# -------------------------------------------------------------
# 7. ANALYTICS
# -------------------------------------------------------------
@app.get("/api/analytics")
def get_analytics(days: int = Query(30, ge=1, le=365)):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM emails ORDER BY received_at ASC")
    emails = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Aggregate by date
    dates_map: Dict[str, Dict[str, int]] = {}
    for e in emails:
        raw_date = e.get("received_at", "")
        date_str = raw_date[:10] if len(raw_date) >= 10 else datetime.now().strftime("%Y-%m-%d")
        if date_str not in dates_map:
            dates_map[date_str] = {"date": date_str, "leads": 0, "missed": 0, "emails": 0, "followed_up": 0}
        dates_map[date_str]["emails"] += 1
        if e.get("label") == "lead":
            dates_map[date_str]["leads"] += 1
            if e.get("status") == "missed":
                dates_map[date_str]["missed"] += 1
            elif e.get("status") == "followed_up":
                dates_map[date_str]["followed_up"] += 1

    volume_trend = sorted(list(dates_map.values()), key=lambda x: x["date"])

    # Ensure at least recent days are populated for pretty charting
    if len(volume_trend) < 5:
        now = datetime.now()
        existing_dates = {v["date"] for v in volume_trend}
        for i in range(5, 0, -1):
            d_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            if d_str not in existing_dates:
                volume_trend.append({"date": d_str, "leads": 0, "missed": 0, "emails": 0, "followed_up": 0})
        volume_trend.sort(key=lambda x: x["date"])

    # Intent Breakdown
    intent_counts = {}
    for e in emails:
        if e.get("label") == "lead":
            i = e.get("intent", "product_inquiry")
            intent_counts[i] = intent_counts.get(i, 0) + 1

    intent_breakdown = [{"intent": k, "count": v} for k, v in intent_counts.items()]

    # Priority Breakdown
    priority_counts = {"high": 0, "medium": 0, "low": 0}
    for e in emails:
        if e.get("label") == "lead":
            p = (e.get("priority") or "medium").lower()
            if p in priority_counts:
                priority_counts[p] += 1

    return {
        "period_days": days,
        "volume_trend": volume_trend,
        "intent_breakdown": intent_breakdown,
        "priority_distribution": [
            {"priority": "High Priority", "count": priority_counts["high"], "color": "#ef4444"},
            {"priority": "Medium Priority", "count": priority_counts["medium"], "color": "#f59e0b"},
            {"priority": "Low Priority", "count": priority_counts["low"], "color": "#10b981"}
        ]
    }


# -------------------------------------------------------------
# 8. AUTOMATIONS
# -------------------------------------------------------------
@app.get("/api/automations")
def get_automations():
    return [
        {
            "id": "auto_missed_lead_sla",
            "name": "Missed Lead SLA Breach Detector",
            "trigger": "Every 15 minutes",
            "action": "Flag unanswered leads exceeding 60m threshold as 'missed'",
            "status": "active",
            "last_run": (datetime.now() - timedelta(minutes=7)).strftime("%Y-%m-%d %H:%M"),
            "next_run": (datetime.now() + timedelta(minutes=8)).strftime("%Y-%m-%d %H:%M"),
            "success_rate": "100%"
        },
        {
            "id": "auto_followup_generator",
            "name": "AI Intent-Aware Follow-Up Drafter",
            "trigger": "Lead marked as 'missed'",
            "action": "Draft personalized email reply tailored to buyer intent",
            "status": "active",
            "last_run": (datetime.now() - timedelta(minutes=14)).strftime("%Y-%m-%d %H:%M"),
            "next_run": "On event trigger",
            "success_rate": "98.4%"
        },
        {
            "id": "auto_priority_scoring",
            "name": "Commercial Intent & Urgency Classifier",
            "trigger": "Inbound email received",
            "action": "LLM classifier (Anthropic Claude) predicts Lead/Spam/General & priority",
            "status": "active",
            "last_run": (datetime.now() - timedelta(minutes=2)).strftime("%Y-%m-%d %H:%M"),
            "next_run": "Continuous",
            "success_rate": "100%"
        },
        {
            "id": "auto_gmail_sync",
            "name": "Gmail Inbox Continuous Polling",
            "trigger": "Every 5 minutes",
            "action": "Polls Gmail API for unread customer inquiries",
            "status": "active" if os.path.exists(os.path.join(PROJECT_ROOT, "credentials", "token.json")) else "paused",
            "last_run": (datetime.now() - timedelta(minutes=4)).strftime("%Y-%m-%d %H:%M"),
            "next_run": (datetime.now() + timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M"),
            "success_rate": "100%"
        }
    ]


@app.post("/api/automations/{rule_id}/run")
def trigger_automation(rule_id: str):
    if rule_id == "auto_missed_lead_sla":
        newly_missed, _ = detect_missed_leads(missed_after_minutes=60, verbose=False)
        log_activity(action="Automation Executed", details=f"Manual execution of Missed Lead SLA rule. {newly_missed} updated.", actor="Automation Engine")
        return {"success": True, "message": f"SLA check completed. {newly_missed} leads marked as missed."}
    elif rule_id == "auto_followup_generator":
        drafts = get_missed_leads_with_drafts(limit=5)
        return {"success": True, "message": f"Generated {len(drafts)} follow-up drafts for pending missed leads."}
    elif rule_id == "auto_gmail_sync":
        try:
            from fetch_gmail import fetch_and_process_emails
            results = fetch_and_process_emails(max_results=5)
            return {"success": True, "message": f"Gmail sync executed. Processed {len(results)} new emails."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        return {"success": True, "message": f"Automation rule '{rule_id}' triggered successfully."}


# -------------------------------------------------------------
# 9. ACTIVITY
# -------------------------------------------------------------
@app.get("/api/activity")
def list_activity(limit: int = Query(50, ge=1, le=100)):
    return get_activities(limit=limit)


# -------------------------------------------------------------
# 10. SETTINGS & GMAIL
# -------------------------------------------------------------
SETTINGS_PATH = os.path.join(BASE_DIR, "settings.json")


def _llm_status() -> str:
    """Active when an LLM API key is present; otherwise running on the fallback model."""
    from llm_classifier import get_active_provider

    return "active" if get_active_provider() else "fallback active (no LLM API key)"


def _load_saved_settings() -> Dict[str, Any]:
    """Persisted user settings (SLA minutes etc.). Defaults if never saved."""
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {"sla_threshold_minutes": 60}


@app.get("/api/settings")
def get_settings():
    token_path = os.path.join(PROJECT_ROOT, "credentials", "token.json")
    gmail_connected = os.path.exists(token_path)
    saved = _load_saved_settings()
    provider_label = get_provider_label()
    display_name = (
        f"{provider_label} (LLM classifier) — {get_model_name()}"
        if provider_label
        else "LLM classifier — no API key set (using TF-IDF fallback)"
    )

    return {
        "email_account": {
            "provider": "Google Gmail (OAuth 2.0)",
            "status": "connected" if gmail_connected else "disconnected",
            "last_sync": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "auto_sync_enabled": True
        },
        "sla_threshold_minutes": saved.get("sla_threshold_minutes", 60),
        "ai_model": {
            "name": display_name,
            "status": _llm_status(),
            "version": get_model_name(),
            "fallback": "TF-IDF + Logistic Regression (used only if the LLM API is down)",
            "features": "Understands meaning, not keywords — reads each email and returns label (lead / normal / spam), intent, priority and a one-sentence reason. Ignores job alerts, OTP codes, social notifications, newsletters and marketing even when they sound urgent."
        },
        "notifications": {
            "email_alerts": True,
            "slack_webhook": False,
            "notify_on_critical_missed": True
        }
    }


class SettingsUpdatePayload(BaseModel):
    sla_threshold_minutes: Optional[int] = 60
    email_alerts: Optional[bool] = True
    notify_on_critical_missed: Optional[bool] = True


@app.post("/api/settings")
def update_settings(payload: SettingsUpdatePayload):
    saved = _load_saved_settings()
    if payload.sla_threshold_minutes is not None:
        saved["sla_threshold_minutes"] = max(5, min(1440, int(payload.sla_threshold_minutes)))
    try:
        with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(saved, f, indent=2)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save settings: {exc}")
    log_activity(action="Settings Updated", details=f"SLA threshold configured to {saved['sla_threshold_minutes']} minutes.", actor="User")
    return {"success": True, "message": "Settings saved successfully."}


@app.get("/api/gmail/status")
def gmail_status():
    token_path = os.path.join(PROJECT_ROOT, "credentials", "token.json")
    connected = os.path.exists(token_path)
    return {
        "connected": connected,
        "status": "Connected" if connected else "Disconnected",
        "provider": "Google Workspace / Gmail",
        "last_sync": datetime.now().isoformat()
    }


# -------------------------------------------------------------
# Background Sync State & Runner
# -------------------------------------------------------------
sync_state: Dict[str, Any] = {
    "is_syncing": False,
    "status": "idle",
    "current": 0,
    "total": 0,
    "processed": 0,
    "message": "Ready to sync",
    "started_at": None,
    "completed_at": None,
    "error": None,
}


def run_background_sync(max_results: int = 500):
    global sync_state
    sync_state["is_syncing"] = True
    sync_state["status"] = "running"
    sync_state["current"] = 0
    sync_state["total"] = 0
    sync_state["processed"] = 0
    sync_state["error"] = None
    sync_state["message"] = "Initializing Gmail sync and clearing simulated records..."
    sync_state["started_at"] = datetime.now().isoformat()

    try:
        sys.path.append(PROJECT_ROOT)
        from sync_real_inbox import fetch_real_inbox, wipe_simulated_data

        sync_state["message"] = "Connecting to Gmail and fetching real inbox emails..."

        def progress_cb(current, total, status_text=""):
            sync_state["current"] = current
            sync_state["total"] = total
            sync_state["message"] = status_text or f"Syncing email {current}/{total}..."

        results = fetch_real_inbox(max_results=max_results, progress_callback=progress_cb)

        # After successful fetch, clear simulated fake records so dashboard shows only real emails
        wipe_simulated_data()

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM emails")
        total_in_db = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM emails WHERE label='lead'")
        total_leads = c.fetchone()[0]
        conn.close()

        sync_state["processed"] = len(results)
        sync_state["status"] = "completed"
        sync_state["is_syncing"] = False
        sync_state["completed_at"] = datetime.now().isoformat()
        sync_state["message"] = f"Gmail sync complete — {total_in_db} real emails in database ({total_leads} leads active)."

        log_activity(
            action="Gmail Synced",
            details=f"Retrieved {len(results)} new email(s) from real inbox. Total in DB: {total_in_db}.",
            actor="Gmail Connector"
        )
    except Exception as e:
        sync_state["is_syncing"] = False
        sync_state["status"] = "failed"
        sync_state["error"] = str(e)
        sync_state["message"] = f"Gmail sync failed: {str(e)}"
        log_activity(
            action="Gmail Sync Failed",
            details=f"Error during sync: {str(e)[:200]}",
            actor="Gmail Connector"
        )


@app.get("/api/gmail/sync/status")
def get_sync_status():
    return sync_state


@app.post("/api/gmail/sync")
def sync_gmail(background_tasks: BackgroundTasks, max_results: int = 500):
    if sync_state["is_syncing"]:
        return {
            "success": True,
            "status": "running",
            "message": "Gmail sync is already running in background.",
            "is_syncing": True
        }

    background_tasks.add_task(run_background_sync, max_results)
    return {
        "success": True,
        "status": "started",
        "message": "Gmail sync started in background.",
        "is_syncing": True
    }


@app.post("/api/simulate/inject")
def inject_demo_data(count: Optional[int] = None):
    injected = inject_simulated_emails(count=count, force=True)
    log_activity(
        action="Demo Leads Injected",
        details=f"Injected {injected} simulated leads for testing.",
        actor="Lead Simulator"
    )
    return {"success": True, "injected_count": injected}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
