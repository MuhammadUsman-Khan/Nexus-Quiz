def generate_feedback(score: float) -> str:
    if score >= 90:
        return "Excellent! You have mastered this topic."
    elif score >= 70:
        return "Good job! Keep practicing to improve further."
    elif score >= 40:
        return "Fair effort. Review the material and try again."
    else:
        return "Needs improvement. Focus on the basics and practice more."