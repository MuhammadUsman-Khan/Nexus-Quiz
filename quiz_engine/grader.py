def grade_answer(user_answer: str, correct_answer: str) -> dict:
    if not user_answer or not correct_answer:
        return {
            "is_correct": False,
            "score": 0,
            "message": "Invalid input"
        }
    
    is_correct = user_answer.strip().lower() == correct_answer.strip().lower()
    score = 1 if is_correct else 0
    return {
        "is_correct": is_correct,
        "score": score,
        "message": "Correct" if is_correct else "Incorrect"
    }