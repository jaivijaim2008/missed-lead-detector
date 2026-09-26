import os
import sys
import time
import argparse
from datetime import datetime

# Configure Windows console for UTF-8 encoding
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from database import create_database, get_lead_stats
from check_missed_leads import detect_missed_leads
from generate_followup import get_missed_leads_with_drafts
from simulate_inbox import inject_simulated_emails


def run_full_pipeline(
    source="simulate",
    sla_minutes=60,
    generate_drafts=True,
    verbose=True
):
    """
    Run the end-to-end Missed Lead Detection Pipeline:
    1. Ingest new emails (Simulated or Live Gmail)
    2. Classify via ML model and assign intent/priority
    3. Detect leads that have breached response SLA (mark as 'missed')
    4. Automatically prepare response follow-up drafts
    5. Print aggregated dashboard stats
    """
    create_database()

    print("\n" + "=" * 60)
    print(f" MISSED LEAD DETECTOR — PIPELINE RUN [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]")
    print("=" * 60)

    # Step 1: Ingestion
    print(f"\n[Step 1/3] Ingesting Emails (Source: {source.upper()})...")
    if source == "gmail":
        try:
            from fetch_gmail import fetch_and_process_emails
            fetch_and_process_emails(max_results=10)
        except Exception as e:
            print(f"Error fetching from Gmail: {e}")
            print("Falling back to simulated email ingestion...")
            inject_simulated_emails()
    else:
        inject_simulated_emails()

    # Step 2: SLA Missed Lead Check
    print(f"\n[Step 2/3] Checking SLA Deadlines (Threshold: {sla_minutes} mins)...")
    newly_missed, all_missed = detect_missed_leads(missed_after_minutes=sla_minutes, verbose=False)
    print(f"-> Marked {newly_missed} lead(s) as newly MISSED.")
    print(f"-> Total active missed leads needing attention: {len(all_missed)}")

    # Step 3: Automated Follow-Up Generation
    drafts = []
    if generate_drafts and all_missed:
        print(f"\n[Step 3/3] Generating Follow-Up Drafts...")
        drafts = get_missed_leads_with_drafts(limit=5)
        print(f"-> Prepared {len(drafts)} customized follow-up draft(s) ready for review.")

    # Summary Stats
    stats = get_lead_stats()
    print("\n" + "=" * 60)
    print(" PIPELINE EXECUTION SUMMARY")
    print("=" * 60)
    print(f"Total Emails in System:       {stats['total']}")
    print(f"Identified Leads:             {stats['leads']} (High Priority: {stats['high_priority']})")
    print(f"New Leads (Within SLA):       {stats['new_leads']}")
    print(f"Missed Leads (SLA Breached):  {stats['missed_leads']}")
    print(f"Followed-Up / Resolved:       {stats['resolved_leads']}")
    print(f"Filtered Spam:                {stats['spam']}")
    print("=" * 60)

    if drafts:
        print("\nTOP ACTION ITEM — READY-TO-SEND DRAFT:")
        top = drafts[0]
        print(f"Lead ID #{top['lead_id']} | Priority: {top['priority'].upper()} | Intent: {top['intent']}")
        print(f"To: {top['to']}")
        print(f"Subject: {top['subject']}")
        print("-" * 50)
        print(top['draft_body'])
        print("-" * 50)

    return stats


def main():
    parser = argparse.ArgumentParser(description="Missed Lead Detector: Unified End-to-End Pipeline.")
    parser.add_argument("--source", "-s", choices=["simulate", "gmail"], default="simulate", help="Email source (default: 'simulate')")
    parser.add_argument("--sla", type=int, default=60, help="SLA response window in minutes (default: 60)")
    parser.add_argument("--watch", "-w", action="store_true", help="Run continuously on an interval")
    parser.add_argument("--interval", type=int, default=60, help="Polling interval in seconds when in watch mode (default: 60)")

    args = parser.parse_args()

    if args.watch:
        print(f"Starting pipeline in watch mode (Interval: {args.interval}s, SLA: {args.sla}m)...")
        try:
            while True:
                run_full_pipeline(source=args.source, sla_minutes=args.sla)
                print(f"\nSleeping for {args.interval} seconds... (Press Ctrl+C to stop)")
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nPipeline watch mode stopped by user.")
    else:
        run_full_pipeline(source=args.source, sla_minutes=args.sla)


if __name__ == "__main__":
    main()
