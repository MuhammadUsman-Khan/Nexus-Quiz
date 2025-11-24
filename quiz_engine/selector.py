def select_difficulty(score: float) -> str:
    if score < 40:
        return "easy"
    elif 40 <= score < 70:
        return "medium"
    else:
        return "hard"