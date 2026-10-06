import os
import joblib
from datetime import datetime

try:
    from app.llm_classifier import classify_email_llm, get_model_name
    from app.database import create_database, save_email
except ImportError:
    from llm_classifier import classify_email_llm, get_model_name
    from database import create_database, save_email

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
MODEL_PATH = os.path.join(PROJECT_ROOT, "model", "lead_classifier.pkl")

create_database()

# ------------------------------------------------------------------
# Fallback model: the old TF-IDF + Logistic Regression pickle.
# Only used when the LLM API call fails or times out, so the app
# keeps working if the API is down. Loaded lazily and cached.
# ------------------------------------------------------------------
_fallback_model = None
_fallback_loaded = False


def _get_fallback_model():
    global _fallback_model, _fallback_loaded
    if not _fallback_loaded:
        try:
            _fallback_model = joblib.load(MODEL_PATH)
        except Exception as exc:
            print(f"[process_email] fallback model unavailable ({exc})")
            _fallback_model = None
        _fallback_loaded = True
    return _fallback_model


def _classify_with_fallback(text):
    """Old TF-IDF pipeline. Returns (prediction, confidence, intent, priority)."""
    model = _get_fallback_model()
    if model is None:
        return "normal", 0.0, "general", "low"

    raw_prediction = model.predict([text])[0]
    probabilities = model.predict_proba([text])[0]
    confidence = max(probabilities) * 100

    # The fallback model distinguishes 7 categories (lead, job_alert,
    # otp_code, social, newsletter, spam, general). The UI keeps three
    # simple buckets, so every "ordinary inbox" category maps to `normal`.
    intent_map = {
        "job_alert": "job alert",
        "otp_code": "verification code",
        "social": "social notification",
        "newsletter": "newsletter",
        "general": "general",
    }

    if raw_prediction == "lead":
        if any(word in text.lower() for word in [
            "price", "pricing", "cost", "buy", "purchase"
        ]):
            intent, priority = "pricing/purchase", "high"
        elif any(word in text.lower() for word in [
            "demo", "meeting", "call", "schedule"
        ]):
            intent, priority = "meeting/demo", "high"
        elif "partnership" in text.lower():
            intent, priority = "partnership", "medium"
        else:
            intent, priority = "product_inquiry", "medium"
        prediction = "lead"

    elif raw_prediction == "spam":
        prediction, intent, priority = "spam", "spam", "low"

    else:
        # job_alert / otp_code / social / newsletter / general -> normal
        prediction = "normal"
        intent = intent_map.get(raw_prediction, "general")
        priority = "low"

    return prediction, confidence, intent, priority


def process_email(sender, subject, body, received_at=None, message_id=None, verbose=True):
    text = (subject or "") + " " + (body or "")

    llm_result = classify_email_llm(sender, subject, body)

    if llm_result is not None:
        # ---- Primary path: LLM classification ----
        prediction = llm_result["label"]
        confidence = llm_result["confidence"]
        intent = llm_result["intent"]
        priority = llm_result["priority"]
        reasoning = llm_result.get("reasoning", "")
        method = f"llm ({llm_result.get('model', get_model_name())})"
    else:
        # ---- Fallback path: local TF-IDF model (API down / no key / error) ----
        prediction, confidence, intent, priority = _classify_with_fallback(text)
        reasoning = "Classified by local TF-IDF fallback model."
        method = "fallback (tf-idf)"

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
        print("Method:", method)
        if reasoning:
            print("Reasoning:", reasoning)
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
        "reasoning": reasoning,
        "method": method,
        "received_at": received_at,
        "message_id": message_id
    }


if __name__ == "__main__":
    process_email(
        "customer@example.com",
        "Pricing Inquiry",
        "Hi, I am interested in your software. Please send me the pricing details."
    )
