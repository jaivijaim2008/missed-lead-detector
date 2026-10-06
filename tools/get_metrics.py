import sys, json, joblib, os, time
import pandas as pd
import numpy as np
from sklearn.metrics import (
    classification_report, accuracy_score, f1_score,
    precision_score, recall_score, roc_auc_score
)
from sklearn.preprocessing import label_binarize
from sklearn.model_selection import train_test_split

sys.stdout.reconfigure(encoding='utf-8')

model = joblib.load("model/lead_classifier.pkl")
meta = json.load(open("model/model_meta.json"))
df = pd.read_csv("dataset/emails.csv")
df["text"] = df["subject"].fillna("") + " " + df["body"].fillna("")

X = df["text"]
y = df["label"]
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

preds = model.predict(X_test)
proba = model.predict_proba(X_test)
classes = model.classes_

print("=== DATASET INFO ===")
print("Total samples:", len(df))
print("Columns:", df.columns.tolist())
print("Label distribution:")
for lbl, cnt in df["label"].value_counts().items():
    pct = cnt / len(df) * 100
    print(f"  {lbl}: {cnt} ({pct:.1f}%)")
print("Train size:", len(X_train), "Test size:", len(X_test))

print()
print("=== MODEL METRICS ===")
print("Model version:", meta["version"])
acc = accuracy_score(y_test, preds)
print("Accuracy:", round(acc * 100, 2), "%")
mp = precision_score(y_test, preds, average="macro")
print("Macro Precision:", round(mp * 100, 2), "%")
mr = recall_score(y_test, preds, average="macro")
print("Macro Recall:", round(mr * 100, 2), "%")
mf1 = f1_score(y_test, preds, average="macro")
print("Macro F1:", round(mf1, 4))
wf1 = f1_score(y_test, preds, average="weighted")
print("Weighted F1:", round(wf1, 4))

y_test_bin = label_binarize(y_test, classes=classes)
auc = roc_auc_score(y_test_bin, proba, multi_class="ovr", average="macro")
print("Macro AUC-ROC:", round(auc, 4))

print()
print("=== PER-CLASS REPORT ===")
print(classification_report(y_test, preds, digits=4))

sample = X_test.iloc[:1]
times = []
for _ in range(500):
    t0 = time.perf_counter()
    model.predict(sample)
    times.append((time.perf_counter() - t0) * 1000)
print(f"Avg inference latency: {np.mean(times):.2f} ms")

model_size = os.path.getsize("model/lead_classifier.pkl")
print(f"Model file size: {model_size / 1024:.1f} KB")
