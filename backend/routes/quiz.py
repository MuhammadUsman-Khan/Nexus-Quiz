from fastapi import APIRouter, HTTPException
from backend.db.firebase_config import db, questions_collection, results_collection
from backend.models.quiz import Quiz, QuizAnswer, NextQuestionRequest
from quiz_engine.difficulty_model import DifficultyModel
from quiz_engine.grader import grade_answer
from quiz_engine.feedback_generator import generate_feedback
from quiz_engine.selector import select_difficulty
from datetime import datetime
import random
import uuid

router = APIRouter()

difficulty_model = DifficultyModel()

active_sessions = {}

class QuizSession:
    def __init__(self, user_id, initial_difficulty):
        self.session_id = str(uuid.uuid4())
        self.user_id = user_id
        self.current_difficulty = initial_difficulty
        self.questions_answered = 0
        self.correct_answers = 0
        self.questions = []
        self.current_question_index = 0
        self.is_completed = False
        self.answered_questions = []  

@router.post("/start")
def start_quiz(quiz: Quiz):
    try:
        if questions_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        initial_difficulty = difficulty_model.predict_difficulty(quiz.previous_score)
        
        session = QuizSession(quiz.user_id, initial_difficulty)
        
        question = get_question_by_difficulty(initial_difficulty, [])
        if not question:
            raise HTTPException(status_code=404, detail="No questions available")
        
        # Store session
        active_sessions[session.session_id] = session
        
        return {
            "session_id": session.session_id,
            "difficulty": initial_difficulty,
            "question": question,
            "questions_answered": 0,
            "correct_answers": 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/next-question")
def get_next_question(payload: dict):
    try:
        session_id = payload.get("session_id")
        previous_score = payload.get("previous_score", 0)  
        
        if not session_id or session_id not in active_sessions:
            raise HTTPException(status_code=404, detail="Quiz session not found")
        
        session = active_sessions[session_id]
        
        session.questions_answered += 1
        if previous_score == 1:
            session.correct_answers += 1
        
        if hasattr(session, 'last_question_id'):
            session.answered_questions.append(session.last_question_id)
        
        if session.questions_answered >= 10:
            return end_quiz_session(session_id)
        
        current_accuracy = (session.correct_answers / session.questions_answered) * 100
        
        new_difficulty = select_difficulty(current_accuracy)
        session.current_difficulty = new_difficulty
        
        question = get_question_by_difficulty(new_difficulty, session.answered_questions)
        if not question:
            question = get_question_by_difficulty(None, session.answered_questions)
            if not question:
                return end_quiz_session(session_id)
        
        session.last_question_id = question["id"]
        
        return {
            "session_id": session_id,
            "difficulty": new_difficulty,
            "question": question,
            "questions_answered": session.questions_answered,
            "correct_answers": session.correct_answers,
            "current_accuracy": current_accuracy,
            "total_questions": 10
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit-answer")
def submit_answer(payload: dict):
    try:
        session_id = payload.get("session_id")
        question_id = payload.get("question_id")
        user_answer = payload.get("user_answer")
        
        if not session_id or session_id not in active_sessions:
            raise HTTPException(status_code=404, detail="Quiz session not found")
        
        question_doc = questions_collection.document(question_id).get()
        if not question_doc.exists:
            raise HTTPException(status_code=404, detail="Question not found")
            
        question_data = question_doc.to_dict()
        correct_answer = question_data.get("correct_answer")
        
        if not correct_answer:
            raise HTTPException(status_code=500, detail="Question has no correct answer")
        
        # Grade the answer
        grade = grade_answer(user_answer, correct_answer)
        
        # Store the current question ID in session
        session = active_sessions[session_id]
        session.last_question_id = question_id
        
        return {
            "is_correct": grade["is_correct"],
            "score": grade["score"],
            "message": grade["message"],
            "correct_answer": correct_answer
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/end-quiz")
def end_quiz(payload: dict):
    try:
        session_id = payload.get("session_id")
        if not session_id or session_id not in active_sessions:
            raise HTTPException(status_code=404, detail="Quiz session not found")
        
        return end_quiz_session(session_id)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retrain-model")
def retrain_model():
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        difficulty_model.train_from_firebase(db)
        return {"message": "Model retrained successfully with latest data"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model retraining failed: {str(e)}")

def end_quiz_session(session_id):
    session = active_sessions[session_id]
    
    final_score = (session.correct_answers / session.questions_answered) * 100 if session.questions_answered > 0 else 0
    
    feedback = generate_feedback(final_score)
    next_difficulty = select_difficulty(final_score)
    
    result_doc = results_collection.document()
    result_doc.set({
        "user_id": session.user_id,
        "total_score": final_score,
        "questions_answered": session.questions_answered,
        "correct_answers": session.correct_answers,
        "final_difficulty": session.current_difficulty,
        "feedback": feedback,
        "next_difficulty": next_difficulty,
        "timestamp": datetime.utcnow()
    })
    
    if db:
        difficulty_model.train_from_firebase(db)
    
    del active_sessions[session_id]
    
    return {
        "final_score": final_score,
        "questions_answered": session.questions_answered,
        "correct_answers": session.correct_answers,
        "feedback": feedback,
        "next_difficulty": next_difficulty,
        "session_completed": True
    }

def get_question_by_difficulty(difficulty, exclude_question_ids=None):
    try:
        if exclude_question_ids is None:
            exclude_question_ids = []
            
        if difficulty:
            docs = questions_collection.where("difficulty", "==", difficulty).get()
        else:
            docs = questions_collection.limit(100).get()
            
        if not docs:
            return None
        
        available_questions = []
        for doc in docs:
            if doc.id not in exclude_question_ids:
                question_data = doc.to_dict()
                question_data["id"] = doc.id
                available_questions.append(question_data)
        
        if not available_questions:
            return None
            
        chosen = random.choice(available_questions)
        return chosen
        
    except Exception as e:
        print(f"Error getting question: {e}")
        return None