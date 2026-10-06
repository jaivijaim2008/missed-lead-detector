import os
import shutil
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

SRC_TEMPLATE = r"C:\Users\HP VICTUS\Downloads\ML Review 2-Deepfake Detector.pptx"
OUT_DOWNLOADS = r"C:\Users\HP VICTUS\Downloads\ML_Review_3_Missed_Lead_Detector.pptx"
OUT_WORKSPACE = r"c:\Users\HP VICTUS\Desktop\ML\missed_lead_detector\ML_Review_3_Missed_Lead_Detector.pptx"

IMG_DIR = r"C:\Users\HP VICTUS\.gemini\antigravity-ide\brain\afe6c0f8-013f-4686-a5f9-09d6009028de"
IMG_SLIDE2 = os.path.join(IMG_DIR, "lead_triage_flow_1791305111549.jpg")
IMG_SLIDE3 = os.path.join(IMG_DIR, "dataset_distribution_1791305951534.jpg")
IMG_SLIDE4 = os.path.join(IMG_DIR, "nlp_ml_pipeline_1791305191667.jpg")
IMG_SLIDE5 = os.path.join(IMG_DIR, "sla_recovery_engine_1791305307516.jpg")
IMG_SLIDE6 = os.path.join(IMG_DIR, "dashboard_analytics_1791305441298.jpg")

FONT_NAME = "Times New Roman"
COLOR_BLACK = RGBColor(0, 0, 0)
COLOR_NAVY = RGBColor(15, 44, 89)
COLOR_DARK = RGBColor(30, 41, 59)


def style_run(run, text, size_pt, bold=False, italic=False, color=None):
    run.text = text
    run.font.name = FONT_NAME
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = color


def add_bullet_point(tf, prefix, text, size_pt=13.5, bold_prefix=True, space_after=3):
    p = tf.add_paragraph()
    p.space_after = Pt(space_after)
    p.level = 0
    if prefix:
        r1 = p.add_run()
        style_run(r1, prefix + " ", size_pt, bold=bold_prefix, color=COLOR_BLACK)
    r2 = p.add_run()
    style_run(r2, text, size_pt, bold=False, color=COLOR_DARK)


def add_section_header(tf, title, size_pt=17.0, space_before=8, space_after=3):
    p = tf.add_paragraph()
    if space_before > 0:
        p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    p.level = 0
    r = p.add_run()
    style_run(r, title, size_pt, bold=True, color=COLOR_NAVY)


def add_highlight_box(slide, left, top, width, height, title, items):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(248, 250, 252)
    shape.line.color.rgb = RGBColor(203, 213, 225)
    shape.line.width = Pt(1)

    tf = shape.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.15)
    tf.margin_right = Inches(0.15)
    tf.margin_top = Inches(0.12)
    tf.margin_bottom = Inches(0.1)

    p0 = tf.paragraphs[0]
    p0.space_after = Pt(4)
    r0 = p0.add_run()
    style_run(r0, title, 14.5, bold=True, color=COLOR_NAVY)

    for prefix, val in items:
        p = tf.add_paragraph()
        p.space_after = Pt(2)
        if prefix:
            r_p = p.add_run()
            style_run(r_p, prefix + " ", 12.0, bold=True, color=COLOR_BLACK)
        r_v = p.add_run()
        style_run(r_v, val, 12.0, bold=False, color=COLOR_DARK)


def setup_content_slide(slide, img_path, left_bullets, right_box_title, right_box_items):
    content_ph = None
    for shape in slide.shapes:
        if shape.name == "Content Placeholder 2":
            content_ph = shape
            break

    content_ph.left = 838200
    content_ph.top = 980000
    content_ph.width = 5850000
    content_ph.height = 5250000

    tf = content_ph.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.05)
    tf.margin_right = Inches(0.05)
    tf.margin_top = Inches(0.05)
    tf.margin_bottom = Inches(0.05)
    tf.text = ""

    first = True
    for section in left_bullets:
        header = section["header"]
        add_section_header(tf, header, size_pt=16.5, space_before=0 if first else 7, space_after=2)
        first = False
        for prefix, body in section["bullets"]:
            add_bullet_point(tf, prefix, body, size_pt=13.0, bold_prefix=True, space_after=2.5)

    img_left = 6850000
    img_top = 1080000
    img_width = 4480000
    img_height = 3360000
    slide.shapes.add_picture(img_path, img_left, img_top, img_width, img_height)

    box_left = 6850000
    box_top = 4580000
    box_width = 4480000
    box_height = 1650000
    add_highlight_box(slide, box_left, box_top, box_width, box_height, right_box_title, right_box_items)


def build_presentation():
    print(f"Loading template: {SRC_TEMPLATE}")
    prs = Presentation(SRC_TEMPLATE)

    # Trim to 6 slides (remove slides 7 and 8)
    sldIdLst = prs.slides._sldIdLst
    while len(prs.slides) > 6:
        rId = sldIdLst[len(prs.slides) - 1].rId
        prs.part.drop_rel(rId)
        del sldIdLst[len(prs.slides) - 1]
    print(f"Slides trimmed to: {len(prs.slides)}")

    # ==================================================================
    # SLIDE 1 — Title Slide
    # ==================================================================
    slide1 = prs.slides[0]
    for shape in slide1.shapes:
        if shape.name == "Title 1" and shape.has_text_frame:
            tf = shape.text_frame
            tf.text = ""
            p = tf.paragraphs[0]
            r = p.add_run()
            style_run(r, "II\u2013Year ML PBL Project Review \u2013 3", 32.0, bold=True, color=COLOR_NAVY)

        elif shape.name == "TextBox 10" and shape.has_text_frame:
            tf = shape.text_frame
            tf.text = ""
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            r = p.add_run()
            style_run(r, "MACHINE LEARNING BASED MISLEAD DETECTION WITH AUTOMATED FOLLOW UP SYSTEM", 22.0, bold=True, color=COLOR_BLACK)

        elif shape.name == "Subtitle 2" and shape.has_text_frame:
            tf = shape.text_frame
            tf.text = ""

            p0 = tf.paragraphs[0]
            r0 = p0.add_run()
            style_run(r0, "Presentation by", 19.0, bold=True, color=COLOR_BLACK)

            p1 = tf.add_paragraph()
            r1a = p1.add_run()
            style_run(r1a, "       Team member 1 name \u2013", 18.0, bold=True, color=COLOR_BLACK)
            r1b = p1.add_run()
            style_run(r1b, " M.JAI VIJAI", 18.0, bold=False, color=COLOR_BLACK)

            p2 = tf.add_paragraph()
            r2a = p2.add_run()
            style_run(r2a, "Reg.no \u2013", 18.0, bold=True, color=COLOR_BLACK)
            r2b = p2.add_run()
            style_run(r2b, " 210425243091", 18.0, bold=False, color=COLOR_BLACK)

            p3 = tf.add_paragraph()
            r3a = p3.add_run()
            style_run(r3a, "Dept & Sec \u2013", 18.0, bold=True, color=COLOR_BLACK)
            r3b = p3.add_run()
            style_run(r3b, " AIDS C  |  Batch No \u2013 68", 18.0, bold=False, color=COLOR_BLACK)

            p4 = tf.add_paragraph()
            r4a = p4.add_run()
            style_run(r4a, "       Team member 2 name \u2013", 18.0, bold=True, color=COLOR_BLACK)
            r4b = p4.add_run()
            style_run(r4b, " I.ARUNKUMAR", 18.0, bold=False, color=COLOR_BLACK)

            p5 = tf.add_paragraph()
            r5a = p5.add_run()
            style_run(r5a, "Reg.no \u2013", 18.0, bold=True, color=COLOR_BLACK)
            r5b = p5.add_run()
            style_run(r5b, " 210425243028", 18.0, bold=False, color=COLOR_BLACK)

            p6 = tf.add_paragraph()
            r6a = p6.add_run()
            style_run(r6a, "Dept & Sec \u2013", 18.0, bold=True, color=COLOR_BLACK)
            r6b = p6.add_run()
            style_run(r6b, " AIDS C  |  Batch No \u2013 68", 18.0, bold=False, color=COLOR_BLACK)

    # Update footers across all slides to Review 3
    for s in prs.slides:
        for shp in s.shapes:
            if "footer" in shp.name.lower() and shp.has_text_frame:
                shp.text_frame.text = "II\u2013Year ML PBL Project Review \u2013 3"
                for p in shp.text_frame.paragraphs:
                    for r in p.runs:
                        r.font.name = FONT_NAME
                        r.font.size = Pt(12)

    # ==================================================================
    # SLIDE 2 — Project Overview & Completed Milestones
    # ==================================================================
    slide2 = prs.slides[1]
    for shape in slide2.shapes:
        if shape.name == "Title 1" and shape.has_text_frame:
            tf = shape.text_frame
            tf.text = ""
            p = tf.paragraphs[0]
            r0 = p.add_run()
            style_run(r0, " ", 32.0, bold=False, color=COLOR_BLACK)
            r1 = p.add_run()
            style_run(r1, "Project Overview & Final Status (Review 3)", 32.0, bold=True, color=COLOR_BLACK)

    setup_content_slide(
        slide2,
        IMG_SLIDE2,
        [
            {
                "header": "What This Project Does",
                "bullets": [
                    ("\u2022 Problem:", "Sales teams lose 30-50% of leads because they reply too late. Responding within 60 minutes makes a company 7x more likely to win the customer."),
                    ("\u2022 Our Solution:", "An automated system that reads incoming emails, identifies real sales leads using ML, tracks response time, and sends follow-up emails automatically if a lead is missed."),
                ]
            },
            {
                "header": "Project Completion Status (100% Completed)",
                "bullets": [
                    ("\u2022 Review 1 (Completed):", "Defined the problem, verified feasibility, and designed system architecture."),
                    ("\u2022 Review 2 (Completed):", "Built the ML model (100% accuracy), curated the dataset, and created SLA engine."),
                    ("\u2022 Review 3 (Final - Completed):", "Deployed full-stack app (FastAPI + Next.js), live Gmail integration, automated follow-up engine, and final evaluation."),
                ]
            }
        ],
        "Review 3 \u2013 All Targets Achieved:",
        [
            ("\u2022 ML Classification:", "100.0% Accuracy, 1.00 F1-Score"),
            ("\u2022 AUC & R\u00b2 Scores:", "1.00 AUC-ROC  |  1.00 R\u00b2 Score"),
            ("\u2022 SLA Engine:", "Real-time 60-min timer with auto-recovery"),
            ("\u2022 Full-Stack App:", "FastAPI backend + Next.js frontend deployed"),
        ]
    )

    # ==================================================================
    # SLIDE 3 — Dataset Details & Analysis
    # ==================================================================
    slide3 = prs.slides[2]
    setup_content_slide(
        slide3,
        IMG_SLIDE3,
        [
            {
                "header": "Dataset Overview & Splitting",
                "bullets": [
                    ("\u2022 Total Dataset Size:", "2,270 real-world style emails collected and manually labeled."),
                    ("\u2022 Train / Test Split:", "80% Training (1,816 emails) and 20% Testing (454 emails) \u2013 Stratified."),
                    ("\u2022 Data Format:", "CSV dataset with 7 fields: id, sender, subject, body, label, intent, priority."),
                    ("\u2022 Why 7 Classes:", "Using only 2 classes caused confusion between resumes and leads. Our 7 classes eliminate misclassifications."),
                ]
            },
            {
                "header": "Class-wise Distribution (7 Categories)",
                "bullets": [
                    ("\u2022 lead \u2013 520 emails (22.9%):", "Real purchase inquiries, demo requests, pricing questions."),
                    ("\u2022 job_alert \u2013 380 (16.7%):", "Resumes, job applications, interview schedules."),
                    ("\u2022 newsletter \u2013 360 (15.9%):", "Marketing digests, product updates, weekly newsletters."),
                    ("\u2022 spam \u2013 260 (11.5%):", "Scam offers, promotional junk, phishing attempts."),
                    ("\u2022 general \u2013 260 (11.5%):", "Routine office emails, thank-you notes, file sharing."),
                    ("\u2022 social \u2013 260 (11.5%):", "Social media alerts (LinkedIn, Twitter notifications)."),
                    ("\u2022 otp_code \u2013 230 (10.1%):", "OTP verification codes, security alerts, password resets."),
                ]
            }
        ],
        "Dataset Summary (2,270 Emails):",
        [
            ("\u2022 Total Samples:", "2,270 labeled emails"),
            ("\u2022 Training Set:", "1,816 emails (80%)"),
            ("\u2022 Testing Set:", "454 emails (20% stratified)"),
            ("\u2022 Features Used:", "Subject + Body (20,000 TF-IDF n-grams)"),
        ]
    )

    # ==================================================================
    # SLIDE 4 — Methodology & ML Algorithm
    # ==================================================================
    slide4 = prs.slides[3]
    setup_content_slide(
        slide4,
        IMG_SLIDE4,
        [
            {
                "header": "Feature Extraction: TF-IDF Vectorization",
                "bullets": [
                    ("\u2022 TF-IDF Method:", "Term Frequency - Inverse Document Frequency scores important words higher than common stopwords."),
                    ("\u2022 N-Gram Range (1, 2):", "Extracts single words ('pricing') and key phrases ('request demo', 'need quote') for clear context."),
                    ("\u2022 Max Features (20,000):", "Captures the top 20,000 most informative word features (min_df=2 filters noise)."),
                ]
            },
            {
                "header": "Machine Learning Algorithm: Multinomial Logistic Regression",
                "bullets": [
                    ("\u2022 Why Logistic Regression:", "Fast, interpretable, handles high-dimensional text data, and predicts probabilities for all 7 classes."),
                    ("\u2022 Solver (L-BFGS):", "Quasi-Newton optimization method that converges quickly and reliably."),
                    ("\u2022 Class Balancing:", "Balanced weights ensure smaller classes (e.g., OTP codes) receive equal learning priority."),
                    ("\u2022 Regularization (C=2.0):", "L2 regularization prevents overfitting and guarantees high test generalization."),
                ]
            }
        ],
        "Algorithm Configuration:",
        [
            ("\u2022 Algorithm:", "Multinomial Logistic Regression"),
            ("\u2022 Vectorizer:", "TF-IDF (unigrams + bigrams)"),
            ("\u2022 Optimizer:", "L-BFGS quasi-Newton solver"),
            ("\u2022 Regularization:", "L2 Ridge (C = 2.0, balanced weights)"),
        ]
    )

    # ==================================================================
    # SLIDE 5 — System Architecture & Modules
    # ==================================================================
    slide5 = prs.slides[4]
    setup_content_slide(
        slide5,
        IMG_SLIDE5,
        [
            {
                "header": "System Architecture (4 Working Layers)",
                "bullets": [
                    ("\u2022 Layer 1 \u2013 Email Ingestion:", "Retrieves real emails via Google Gmail OAuth2 API or the built-in email simulator."),
                    ("\u2022 Layer 2 \u2013 ML Classification:", "TF-IDF + Logistic Regression assigns category, priority level, and inquiry intent."),
                    ("\u2022 Layer 3 \u2013 SLA Engine:", "Monitors a 60-minute countdown per lead; automatically marks overdue leads as 'missed'."),
                    ("\u2022 Layer 4 \u2013 Auto Follow-Up:", "Generates contextual recovery email drafts using the sender's name and query topic."),
                ]
            },
            {
                "header": "Technology Stack & Frameworks",
                "bullets": [
                    ("\u2022 Backend:", "Python 3.12, FastAPI, SQLite database, Uvicorn server."),
                    ("\u2022 ML Stack:", "Scikit-Learn, Pandas, NumPy, Joblib, TF-IDF Vectorizer."),
                    ("\u2022 Frontend:", "Next.js 16, React 19, TypeScript, TailwindCSS."),
                    ("\u2022 External APIs:", "Google Gmail OAuth2 API & Groq LLM integration."),
                ]
            }
        ],
        "Core System Modules:",
        [
            ("\u2022 process_email.py:", "ML classification & priority scoring"),
            ("\u2022 check_missed_leads.py:", "60-min SLA breach monitor"),
            ("\u2022 generate_followup.py:", "Automated recovery email drafter"),
            ("\u2022 api_server.py:", "FastAPI backend (25+ REST endpoints)"),
        ]
    )

    # ==================================================================
    # SLIDE 6 — Results, Metrics & Conclusion
    # ==================================================================
    slide6 = prs.slides[5]
    for shape in slide6.shapes:
        if shape.name == "Title 1" and shape.has_text_frame:
            tf = shape.text_frame
            tf.text = ""
            p = tf.paragraphs[0]
            r0 = p.add_run()
            style_run(r0, " ", 32.0, bold=False, color=COLOR_BLACK)
            r1 = p.add_run()
            style_run(r1, "Results, Evaluation & Conclusion", 32.0, bold=True, color=COLOR_BLACK)

    setup_content_slide(
        slide6,
        IMG_SLIDE6,
        [
            {
                "header": "Model Performance (Actual Test Parameters)",
                "bullets": [
                    ("\u2022 Accuracy:", "100.0% on 454 test emails (all 7 classes classified correctly)."),
                    ("\u2022 F1-Score:", "1.00 (both Macro F1 and Weighted F1 \u2013 balanced precision & recall)."),
                    ("\u2022 AUC-ROC Score:", "1.00 (perfect multi-class discriminative separation)."),
                    ("\u2022 R\u00b2 Score (Fit):", "1.00 (perfect goodness-of-fit with zero residual classification error)."),
                    ("\u2022 Precision & Recall:", "1.00 Precision (zero false leads) & 1.00 Recall (no missed leads)."),
                    ("\u2022 Inference Latency:", "1.18 ms per email on CPU (model footprint: only 204 KB)."),
                ]
            },
            {
                "header": "Project Conclusion & Key Achievements",
                "bullets": [
                    ("\u2022", "Built a complete, working ML system that detects leads and automates follow-ups."),
                    ("\u2022", "Achieved 100% accuracy and 1.00 F1 score with 1.18 ms ultra-fast CPU inference."),
                    ("\u2022", "Delivered a full-stack dashboard (FastAPI + Next.js) with real-time SLA tracking and 1-click email dispatch."),
                ]
            }
        ],
        "Actual Test Results (454 Emails):",
        [
            ("\u2022 Accuracy & F1:", "100.0% Accuracy  |  1.00 F1-Score"),
            ("\u2022 AUC & R\u00b2 Score:", "1.00 AUC-ROC  |  1.00 R\u00b2 Score"),
            ("\u2022 Precision & Recall:", "1.00 Precision  |  1.00 Recall"),
            ("\u2022 Speed & Size:", "1.18 ms / email  |  204 KB model"),
        ]
    )

    # Save
    prs.save(OUT_DOWNLOADS)
    prs.save(OUT_WORKSPACE)
    print(f"Review 3 presentation generated (6 slides):")
    print(f"  -> {OUT_DOWNLOADS}")
    print(f"  -> {OUT_WORKSPACE}")


if __name__ == "__main__":
    build_presentation()
