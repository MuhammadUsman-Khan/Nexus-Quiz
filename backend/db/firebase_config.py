import firebase_admin
from firebase_admin import credentials, firestore
import os

try:
    current_dir = os.path.dirname(__file__)
    json_path = os.path.join(current_dir, "serviceAccountKey.json")


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