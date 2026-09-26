import os
import joblib
from datetime import datetime

try:
    from app.database import create_database, save_email
except ImportError:
    from database import create_database, save_email

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
MODEL_PATH = os.path.join(PROJECT_ROOT, "model", "lead_classifier.pkl")

model = joblib.load(MODEL_PATH)

create_database()


def process_email(sender, subject, body, received_at=None, message_id=None, verbose=True):
    text = (subject or "") + " " + (body or "")

    prediction = model.predict([text])[0]
    probabilities = model.predict_proba([text])[0]
    confidence = max(probabilities) * 100

    if prediction == "lead":
        if any(word in text.lower() for word in [
            "price", "pricing", "cost", "buy", "purchase"
        ]):
            intent = "pricing/purchase"
            priority = "high"

        elif any(word in text.lower() for word in [
            "demo", "meeting", "call", "schedule"
        ]):
            intent = "meeting/demo"
            priority = "high"

        elif "partnership" in text.lower():
            intent = "partnership"
            priority = "medium"

        else:
            intent = "product_inquiry"
            priority = "medium"

    elif prediction == "spam":
        intent = "spam"
        priority = "low"

    else:
        intent = "general"
        priority = "low"

    if not received_at:
        received_at = datetime.now().isoformat()

    save_email(
        sender=sender,
        subject=subject,
        body=body,
        label=prediction,
        confidence=confidence,
        intent=intent,
        priority=priority,
        received_at=received_at,
        message_id=message_id
    )

    if verbose:
        print("\n==============================")
        print("EMAIL PROCESSED")
        print("==============================")
        print("Sender:", sender)
        print("Subject:", subject)
        print("Prediction:", prediction)
        print("Confidence:", round(confidence, 2), "%")
        print("Intent:", intent)
        print("Priority:", priority)
        if message_id:
            print("Message ID:", message_id)
        print("Saved to database.")

    return {
        "sender": sender,
        "subject": subject,
        "label": prediction,
        "prediction": prediction,
        "confidence": confidence,
        "intent": intent,
        "priority": priority,
        "received_at": received_at,
        "message_id": message_id
    }


if __name__ == "__main__":
    process_email(
        "customer@example.com",
        "Pricing Inquiry",
        "Hi, I am interested in your software. Please send me the pricing details."
    )

