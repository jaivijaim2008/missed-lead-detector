import pandas as pd
import joblib

model = joblib.load("model/lead_classifier.pkl")

df = pd.read_csv("dataset/real_test_emails.csv")

print("\n==============================")
print("REAL-WORLD STYLE TEST")
print("==============================")

correct = 0

for _, row in df.iterrows():
    prediction = model.predict([row["text"]])[0]
    confidence = max(model.predict_proba([row["text"]])[0]) * 100

    if prediction == row["expected"]:
        correct += 1

    print("\nEmail:", row["text"])
    print("Expected:", row["expected"])
    print("Predicted:", prediction)
    print("Confidence:", round(confidence, 2), "%")

accuracy = correct / len(df) * 100

print("\n==============================")
print("TEST RESULT")
print("==============================")
print("Correct:", correct, "/", len(df))
print("Accuracy:", round(accuracy, 2), "%")
