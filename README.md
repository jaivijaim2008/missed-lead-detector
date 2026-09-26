# 🎯 AI-Powered Missed Lead Detector & Recovery Suite

An end-to-end Machine Learning pipeline and interactive operations dashboard that detects incoming sales leads, tracks response SLAs, flags neglected inquiries, and automatically drafts personalized follow-up emails to recover revenue.

---

## 💡 The Problem & Solution
- **The Problem:** Studies show that replying to an inbound lead within 1 hour makes a company **7x more likely** to qualify the lead. Yet, sales teams frequently miss high-intent inquiries buried under newsletters, spam, and internal emails.
- **The Solution:** An automated system that ingests incoming emails, classifies them into **`lead`**, **`spam`**, or **`general`** using NLP/ML, tags them by purchase intent and priority, monitors response time against an SLA deadline, and automatically prepares ready-to-send recovery drafts when a lead goes unanswered.

---

## 🚀 Key Features

1. **Machine Learning Classification**:
   - TF-IDF Vectorizer + Scikit-Learn Logistic Regression model trained on domain-specific inbound inquiries.
   - Accurately distinguishes commercial leads from newsletters, cold outreach, and routine correspondence.

2. **Intent & Priority Engine**:
   - Automatically maps leads to specific buyer intents: `pricing/purchase`, `meeting/demo`, `partnership`, or `product_inquiry`.
   - Assigns dynamic urgency levels: `HIGH`, `MEDIUM`, or `LOW`.

3. **SLA Breach Monitoring**:
   - Configurable response window (e.g., 60 minutes).
   - Automatically flags leads exceeding the deadline as `missed`.

4. **Automated Follow-Up Generator**:
   - Context-aware recovery emails tailored to the lead's specific inquiry and sender name.

5. **Built-in Demo Email Simulator**:
   - Fully testable and demonstrable offline! No real customer emails required — inject realistic enterprise inquiries with realistic timestamps at the click of a button.

6. **Live Gmail API Integration**:
   - Optional OAuth2 connector to pull real emails directly from any Gmail inbox.

7. **Interactive Operations Dashboard (Streamlit)**:
   - Real-time KPI metrics, visual charts, lead queue filters, one-click draft review/approval, and an interactive ML testing playground.

---

## 📁 Project Architecture

```text
missed_lead_detector/
├── app/
│   ├── dashboard.py           # Streamlit interactive UI & operations center
│   ├── run_pipeline.py        # Unified CLI pipeline orchestrator
│   ├── simulate_inbox.py      # Demo email injector with realistic timestamps
│   ├── fetch_gmail.py         # Live Gmail API ingestion & body parser
│   ├── gmail_auth.py          # Google OAuth2 authentication service
│   ├── process_email.py       # ML classifier & priority scoring module
│   ├── check_missed_leads.py  # SLA response window & breach detector
│   ├── generate_followup.py   # Intent-specific follow-up email generator
│   ├── database.py            # SQLite schema, migration & helper functions
│   └── leads.db               # SQLite database
├── dataset/
│   ├── emails.csv             # Training dataset (leads, spam, general)
│   └── real_test_emails.csv   # Validation set for model benchmarking
├── model/
│   └── lead_classifier.pkl    # Serialized scikit-learn ML model
├── credentials/               # OAuth2 credentials & tokens (optional)
├── generate_dataset.py        # Dataset generation script
├── train_model.py             # Model training & evaluation pipeline
├── test_model.py              # Model accuracy validation script
└── requirements.txt           # Project dependencies
```

---

## ⚡ Quickstart

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Launch the Interactive Dashboard (Recommended)
Launch the visual web dashboard to explore the system, test sample leads, and review follow-ups:
```bash
streamlit run app/dashboard.py
```
> Inside the dashboard, click **"🚀 Inject 7 Demo Leads / Emails"** on the sidebar to instantly populate the system with realistic data.

---

### 3. Run the Unified CLI Pipeline
Run the full ingestion, classification, SLA check, and follow-up generation from the command line:

```bash
# Run with simulated demo emails (Default)
python app/run_pipeline.py

# Run with a custom SLA window of 30 minutes
python app/run_pipeline.py --sla 30

# Run with live Gmail inbox
python app/run_pipeline.py --source gmail

# Run continuously in background watch mode (polls every 60s)
python app/run_pipeline.py --watch --interval 60
```

---

### 4. Standalone Tool Commands

```bash
# Ingest 7 realistic simulated leads with elapsed timestamps
python app/simulate_inbox.py

# Check for leads exceeding the 60-minute SLA window
python app/check_missed_leads.py --minutes 60

# Generate customized follow-up drafts for missed leads
python app/generate_followup.py

# View current database contents
python app/view_leads.py

# Retrain the ML classification model
python train_model.py
```

---

## 🛠️ Tech Stack
- **Language**: Python 3.10+
- **Machine Learning & NLP**: Scikit-Learn, Pandas, Joblib
- **Database**: SQLite3
- **Frontend / Dashboard**: Streamlit, Plotly
- **Integrations**: Google Gmail API (OAuth2)
