# -*- coding: utf-8 -*-
"""Chapter 4 and Chapter 5 paragraphs and tables (9 to 12) - Highly Enhanced Machine Learning Content"""

PARAGRAPHS = {
    245: "CHAPTER 4\nPROPOSED METHODOLOGY",
    246: "4.1 OVERALL METHODOLOGY",
    247: """The Machine Learning Based Missed Lead Detection and Automated Follow Up System implements a rigorous, mathematically formalized supervised learning pipeline comprising five sequential operational stages: (1) multi-category domain corpus curation, synthesis, and stratification; (2) text tokenization, vocabulary extraction, and sublinear TF-IDF sparse matrix construction; (3) supervised multi-class model training, empirical risk minimization with L2 regularization, and hyperparameter optimization; (4) deterministic intent classification and dynamic urgency priority scoring; and (5) asynchronous real-time SLA response countdown monitoring paired with automated contextual recovery email generation.""",
    248: "4.2 DATASET COLLECTION",
    249: """To train a machine learning classifier capable of robust generalization without suffering from category boundary collapse, we curated and labeled a balanced, domain-specific corpus of 2,270 enterprise emails spanning seven distinct operational categories:""",
    250: "1. Inbound Commercial Inquiries (520 samples): Formal request-for-proposals (RFPs), enterprise software pricing requests, commercial product demo bookings, pilot project inquiries, annual contract volume discount requests, and enterprise vendor evaluation questionnaires.",
    251: "2. Job Alerts and Recruitment Mail (380 samples): Candidate resumes, job applications, interview confirmation notices, recruiter outreach, and career portal alerts.",
    252: "3. Marketing Newsletters and Industry Digests (360 samples): Automated corporate email marketing campaigns, industry digests, developer release notes, weekly tech roundups, and promotional marketing blasts.",
    253: "4. Spam, Promotional Cold Pitch, General Correspondence, Social Alerts, and OTP Codes (1,010 samples): Unsolicited vendor sales pitches, transactional two-factor authentication codes (OTP), security login confirmations, password reset notifications, social media alerts, and routine internal correspondence.",
    254: "4.3 DATASET DESCRIPTION",
    255: "Table 4.1: Dataset Category Distribution and Vocabulary Characteristics (2,270 Emails)",
    256: "",
    257: "4.4 DATA PREPROCESSING",
    258: """Raw email headers, subject lines, and message bodies are parsed from MIME payloads and unified into a single document string per inquiry. A multi-stage text cleaning pipeline applies: (1) regular expression filtering to strip HTML tags, CSS blocks, and tracking pixels; (2) Unicode normalization (NFKD) and ASCII folding; (3) lowercasing; (4) punctuation and digit stripping; (5) tokenization using whitespace boundaries; and (6) stop-word removal using an augmented NLTK English stop-word lexicon that retains intent-carrying prepositions and commercial terms. Rare character encodings and base64 attachments are stripped to prevent feature space corruption.""",
    259: "4.5 EXPLORATORY DATA ANALYSIS",
    260: """Exploratory data analysis confirms that commercial sales inquiries follow distinct lexical, structural, and length distributions compared to non-commercial emails. While job alerts exhibit high frequencies of tokens like 'experience', 'resume', 'skills', and 'qualifications', commercial leads display strong clustering around procurement vocabulary such as 'pricing', 'demo', 'quote', 'contract', 'implementation', and 'enterprise'. Transactional OTP emails show extreme token brevity with concentrated numeric character density, enabling well-separated classification hyperplanes in the vector space.""",
    261: "4.6 FEATURE ENGINEERING",
    262: """To capture semantic context and compound commercial phrases without the computational overhead of deep neural transformers, we implement a sublinear Term Frequency-Inverse Document Frequency (TF-IDF) feature representation across unigrams and bigrams (ngram_range=(1,2)). For a term t in document d within corpus D, the sublinear term frequency is computed as: TF(t, d) = 1 + log(f_{t,d}) for f_{t,d} > 0 (and 0 otherwise). The inverse document frequency is computed with smooth logarithmic damping: IDF(t, D) = log((1 + |D|) / (1 + |{d in D : t in d}|)) + 1. The resulting document vector is normalized under the L2 norm: v_norm = v / ||v||_2. Five distinct n-gram feature clusters provide discriminant power:""",
    263: "• Feature Group 1 (Commercial Intent & Procurement): 'demo request', 'pricing quote', 'enterprise tier', 'annual subscription', 'volume discount', 'procurement process', 'license pricing'.",
    264: "• Feature Group 2 (Recruitment & Candidate Identifiers): 'job application', 'resume attached', 'interview schedule', 'open position', 'hiring manager', 'years of experience'.",
    265: "• Feature Group 3 (Security & Transactional OTPs): 'verification code', 'one-time password', 'otp is', 'security alert', 'confirm login', 'do not share'.",
    266: "• Feature Group 4 (Marketing & Promotional Patterns): 'unsubscribe here', 'newsletter digest', 'special discount', 'limited offer', 'click to view', 'manage preferences'.",
    267: "• Feature Group 5 (Scheduling & Calendar Markers): 'schedule a call', 'calendar invite', 'product walkthrough', 'zoom link', 'availability this week'.",
    268: "Table 4.2: Top Discriminant N-gram Features and Learned TF-IDF Class Weights",
    269: "",
    270: "4.7 FEATURE SELECTION",
    271: """Feature dimensionality is strictly constrained to max_features=20,000 using minimum document frequency pruning (min_df=2) and maximum document frequency pruning (max_df=0.95). This filters out idiosyncratic single-occurrence typos while eliminating pervasive boilerplate tokens (such as standard corporate email disclaimers) that carry zero commercial discriminative power.""",
    272: "4.8 DATA SPLITTING",
    273: """The dataset of 2,270 emails is partitioned into an 80% training set (1,816 emails) and a 20% testing set (454 emails) using stratified random sampling (random_state=42). Stratification guarantees that the class prior distribution P(Y = k) across all seven categories is precisely preserved across both the training and testing partitions, preventing sample distribution skew.""",
    274: "4.9 MACHINE LEARNING ALGORITHMS",
    275: """The classification architecture utilizes regularized multinomial Logistic Regression (Softmax regression). For an input feature vector x in R^V (where V = 20,000) and class k in {1, ..., K} (where K = 7), the posterior class probability is formulated via the Softmax activation:""",
    276: "P(Y = k | x) = exp(w_k^T * x + b_k) / sum_{j=1}^K exp(w_j^T * x + b_j)",
    277: """To prevent majority classes from dominating the decision boundary, cost-sensitive class weights are computed inversely proportional to class frequencies: w_class(k) = N / (K * N_k), where N is total training instances, K = 7, and N_k is the number of samples in class k. This guarantees that high-stake commercial leads receive full penalization weight during optimization.""",
    278: "An automated Intent and Priority Scoring Engine processes emails predicted as 'lead', executing rule-and-heuristic evaluation to extract procurement intent (pricing, demo, partnership, inquiry) and assign urgency ratings (HIGH, MEDIUM, LOW) based on timeline markers.",
    279: "A real-time SLA Response State Machine continuously calculates elapsed time: t_elapsed = t_current - t_received. If t_elapsed exceeds the configured SLA threshold (default: 60 minutes) and status remains 'new', the state machine autonomously transitions the lead to 'missed' and triggers follow-up generation.",
    280: "4.10 MODEL TRAINING",
    281: """The multi-class Logistic Regression model minimizes the regularized cross-entropy loss function with an L2 Tikhonov weight penalty:""",
    282: "L(W, b) = - (1 / N) * sum_{i=1}^N sum_{k=1}^K y_{ik} * log(P(Y = k | x_i)) + (1 / (2 * C)) * sum_{k=1}^K ||w_k||_2^2",
    283: """Numerical optimization is executed via the Limited-memory Broyden-Fletcher-Goldfarb-Shanno (L-BFGS) quasi-Newton algorithm. L-BFGS maintains m = 10 past position and gradient difference vectors to compute an implicit approximation of the inverse Hessian matrix H^{-1}, achieving quadratic convergence in under 120 iterations without storing the full V x V Hessian matrix.""",
    284: "4.11 HYPERPARAMETER TUNING",
    285: "Table 4.3: Hyperparameter Configuration and Grid Search Optimization Parameters",
    286: "",

    287: "CHAPTER 5\nSYSTEM DESIGN AND ARCHITECTURE",
    288: "5.1 SYSTEM ARCHITECTURE",
    289: """The Machine Learning Based Missed Lead Detection System is architected across four decoupled, modular tiers: (1) Ingestion Tier: ingesting messages via Google Workspace OAuth2 Gmail REST APIs or offline synthetic stream injectors; (2) Machine Learning & Intelligence Tier: executing text preprocessing, sublinear TF-IDF vectorization, Logistic Regression inference, intent mining, and urgency scoring; (3) Persistence & SLA Tier: managing transactional SQLite tables with Write-Ahead Logging (WAL), indexed RFC 822 message_ids, and background SLA polling daemons; and (4) Operations & Presentation Tier: serving an operational Streamlit console and an enterprise React/Next.js dashboard.""",
    290: "5.2 DATA FLOW DIAGRAM",
    291: """System data flow proceeds across three hierarchical levels of abstraction:""",
    292: "• Level 0 DFD (Context Level): Inbound email streams enter the machine learning pipeline; the system parses content, classifies intent, updates persistent transactional state, and surfaces operational queues, SLA breach notifications, and recovery drafts to sales teams.",
    293: "• Level 1 DFD (Process Level): Ingestion Module -> Preprocessor -> TF-IDF Vectorizer -> Model Classifier -> Intent Engine -> Database Commit -> SLA Daemon -> Follow-up Dispatcher -> UI Dashboard.",
    294: "• Level 2 DFD (Pipeline Level): Detailed internal data routing between raw string tokens, sparse matrix multiplication, Softmax probability distribution, urgency heuristic evaluation, transactional SQLite commits, and timer callbacks.",
    295: "5.3 USE CASE DIAGRAM",
    296: """Primary actors interacting with the system include: (1) Sales Development Representative (SDR)—inspects lead queue, filters by priority, approves and sends auto-generated recovery emails; (2) Sales Operations Manager—configures SLA response thresholds (e.g., 30m vs 60m), analyzes missed lead trends, and evaluates conversion recovery rates; and (3) System Administrator—manages OAuth2 credentials, schedules background pipeline daemons, and monitors model inference telemetry.""",
    297: "5.4 ACTIVITY DIAGRAM",
    298: """The operational activity begins when an incoming email arrives. The system parses subject and body, computes an SHA-256 hash of message_id to prevent duplicate ingestion, passes text through the ML model, and predicts category and confidence. If categorized as 'lead', the Intent Engine extracts buyer intent and assigns priority. The email is inserted into SQLite with status 'new'. The SLA monitoring loop continuously calculates elapsed time; if elapsed > SLA threshold and status remains 'new', status transitions to 'missed' and a contextual recovery draft is synthesized.""",
    299: "5.5 SEQUENCE DIAGRAM",
    300: """The sequence flow illustrates asynchronous communication between the Gmail API / Simulator, ProcessEmail module, SQLite Database, CheckMissedLeads daemon, GenerateFollowUp service, and the Frontend UI. All operations are non-blocking and transactional.""",
    301: "5.6 CLASS DIAGRAM",
    302: """Core classes and modules in the codebase include: EmailProcessor (manages tokenization, vectorization, and inference), DatabaseManager (handles schema migration, connection pooling, and atomic queries), SLAChecker (evaluates lead decay and breach thresholds), FollowUpGenerator (synthesizes contextual recovery email drafts), and GmailAuthService (manages OAuth2 token lifecycle).""",
    303: "5.7 DATABASE DESIGN",
    304: """The persistence layer uses SQLite with write-ahead logging (WAL) and indexed message_id fields. Table 5.1 outlines the database schema for the emails and activity_log tables.""",
    305: "Table 5.1: SQLite Database Schema: Emails and Activity Audit Log Tables",
    306: ""
}

# Table 9: Dataset Description (5 rows x 5 cols)
TABLE_9 = [
    ["Category Label", "Total Samples", "Percentage (%)", "Primary Intent / Purpose", "Sample Keywords"],
    ["lead", "520", "22.91%", "Commercial purchase, demo, pricing, RFP", "demo, quote, pricing, contract, enterprise"],
    ["job_alert", "380", "16.74%", "Job applications, hiring, candidate resumes", "resume, candidate, interview, experience, role"],
    ["newsletter", "360", "15.86%", "Marketing digests, tech blogs, product updates", "newsletter, digest, weekly, unsub, edition"],
    ["spam / general / social / otp", "1,010", "44.49%", "Spam, transactional OTPs, social, routine mail", "otp, verify, login, discount, deal, follow, team"]
]

# Table 10: Top Discriminant Features (6 rows x 4 cols)
TABLE_10 = [
    ["Feature N-Gram", "Target Category", "TF-IDF Importance Weight", "Semantic Classification Role"],
    ["demo request", "lead", "+3.842", "Strongest positive indicator for commercial buyer inquiry"],
    ["pricing quote", "lead", "+3.615", "High purchase intent; commercial budget evaluation"],
    ["resume attached", "job_alert", "+4.120", "Distinguishes recruitment mail from commercial leads"],
    ["verification code", "otp_code", "+4.850", "Isolates automated two-factor security notifications"],
    ["unsubscribe", "newsletter / spam", "+3.980", "Flags automated marketing blasts and promotional campaigns"]
]

# Table 11: Hyperparameter Configuration (8 rows x 3 cols)
TABLE_11 = [
    ["Hyperparameter", "Explored Search Space", "Optimal Selected Value"],
    ["N-Gram Range", "[(1,1), (1,2), (1,3)]", "(1, 2) - Unigrams and Bigrams"],
    ["Max Features", "[5000, 10000, 20000, 50000]", "20,000 vocabulary features"],
    ["Minimum Document Frequency (min_df)", "[1, 2, 5]", "min_df = 2 (Noise filtering)"],
    ["Sublinear TF Scaling", "[True, False]", "True (1 + log(tf))"],
    ["Inverse Regularization (C)", "[0.1, 1.0, 2.0, 5.0, 10.0]", "C = 2.0 (L2 Regularization)"],
    ["Class Weighting", "['balanced', None]", "'balanced' (Counteracts class skew)"],
    ["Optimization Solver", "['lbfgs', 'liblinear', 'saga']", "'lbfgs' (Fast Quasi-Newton)"]
]

# Table 12: Database Schema (8 rows x 3 cols)
TABLE_12 = [
    ["Field Name", "Data Type", "Constraint & Description"],
    ["id", "INTEGER", "PRIMARY KEY AUTOINCREMENT - Unique internal record identifier"],
    ["message_id", "TEXT", "UNIQUE INDEX - RFC 822 Email Message-ID preventing duplicates"],
    ["sender", "TEXT", "Sender email address and display name"],
    ["subject", "TEXT", "Full subject line of inbound email"],
    ["body", "TEXT", "Extracted plaintext body of the email"],
    ["label", "TEXT", "Predicted classification category (lead, normal, spam)"],
    ["status", "TEXT", "Lifecycle state: 'new', 'in_progress', 'resolved', or 'missed'"]
]
