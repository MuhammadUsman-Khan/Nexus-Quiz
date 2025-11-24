from pydantic import BaseModel
from typing import Optional, List

class Question(BaseModel):
    id: Optional[str] = None          
    question_text: str
    options: List[str]
    correct_answer: str
    difficulty: str