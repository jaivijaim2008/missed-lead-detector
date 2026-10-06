"""
Trains the LeadGuard classifier on dataset/emails.csv (multi-category).

The model learns all 7 categories (lead, job_alert, otp_code, social,
newsletter, spam, general) which gives it a much sharper boundary than the
old 3-class lead/normal/spam setup — job alerts, OTP mails, social
notifications and newsletters can no longer drift into "lead".

Outputs:
  model/lead_classifier.pkl   – the sklearn pipeline
  model/model_meta.json       – {"version": "2.0.0", "trained_at": ..., "accuracy": ...}

app/process_email.py loads the pkl and maps everything except lead/spam to
"normal" for the UI's three simple buckets.
"""

import json
from datetime import datetime

import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

MODEL_VERSION = "2.0.0"
MODEL_PATH = "model/lead_classifier.pkl"
META_PATH = "model/model_meta.json"

df = pd.read_csv("dataset/emails.csv")
df["text"] = df["subject"].fillna("") + " " + df["body"].fillna("")

X = df["text"]
y = df["label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            max_features=20000,
            min_df=2,
        ),
    ),
    (
        "classifier",
        LogisticRegression(max_iter=2000, class_weight="balanced", C=2.0),
    ),
])

model.fit(X_train, y_train)
predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("\n==============================")
print("MODEL EVALUATION")
print("==============================")
print("\nAccuracy:", round(accuracy * 100, 2), "%")
print("\nClassification Report:")
print(classification_report(y_test, predictions))
print("Confusion Matrix:")
print(confusion_matrix(y_test, predictions))

joblib.dump(model, MODEL_PATH)

meta = {
    "version": MODEL_VERSION,
    "trained_at": datetime.now().isoformat(timespec="seconds"),
    "accuracy": round(accuracy * 100, 2),
    "dataset_rows": int(len(df)),
    "classes": sorted(df["label"].unique().tolist()),
}
with open(META_PATH, "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2)

print("\nModel saved to:", MODEL_PATH)
print("Meta saved to:", META_PATH, "->", meta)
