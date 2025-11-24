from pydantic import BaseModel
from typing import List, Optional

class QuizQuestion(BaseModel):
    id: str
    user_answer: str

class Quiz(BaseModel):
    user_id: str                        
    previous_score: float = 0.0

class QuizAnswer(BaseModel):
    session_id: str
    question_id: str
    user_answer: str

class NextQuestionRequest(BaseModel):
    session_id: str
    previous_score: float  