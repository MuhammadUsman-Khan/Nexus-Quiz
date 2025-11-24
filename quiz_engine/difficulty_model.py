import pickle
import numpy as np
from sklearn.linear_model import LogisticRegression
import os

class DifficultyModel:
    def __init__(self):
        model_path = os.path.join(os.path.dirname(__file__), "difficulty_model.pkl")
        try:
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
        except FileNotFoundError:
            self.model = LogisticRegression()
            # Minimal initial fit
            X_init = np.array([[0], [50], [80]])
            y_init = np.array([0, 1, 2])
            self.model.fit(X_init, y_init)
            self.save_model()

    def save_model(self):
        model_path = os.path.join(os.path.dirname(__file__), "difficulty_model.pkl")
        with open(model_path, "wb") as f:
            pickle.dump(self.model, f)

    def predict_difficulty(self, previous_score: float) -> str:
        pred = self.model.predict(np.array([[previous_score]]))[0]
        return ["easy", "medium", "hard"][pred]

    def train_from_firebase(self, db) -> None:
        try:
            docs = db.collection("results").get()
            X, y = [], []
            for doc in docs:
                data = doc.to_dict()
                score = data.get("total_score", 0)
                label = 0 if score < 40 else 1 if score < 70 else 2
                X.append([score])
                y.append(label)

            if X and y:
                self.model.fit(np.array(X), np.array(y))
                self.save_model()
                print(f"Model retrained with {len(X)} samples")
        except Exception as e:
            print(f"Training error: {e}")