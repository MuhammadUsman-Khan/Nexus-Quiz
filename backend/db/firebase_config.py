import firebase_admin
from firebase_admin import credentials, firestore
import os

try:
    json_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    if not json_path:
        raise ValueError("GOOGLE_APPLICATION_CREDENTIALS environment variable not set")

    cred = credentials.Certificate(json_path)
    firebase_admin.initialize_app(cred)

    db = firestore.client()
    users_collection = db.collection("users")
    questions_collection = db.collection("questions")
    results_collection = db.collection("results")
    quizzes_collection = db.collection("quizzes")

except Exception as e:
    print(f"Firebase initialization error: {e}")
    db = None
    users_collection = None
    questions_collection = None
    results_collection = None
    quizzes_collection = None
