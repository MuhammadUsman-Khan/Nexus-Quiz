from fastapi import APIRouter, HTTPException, Request
import requests
import html
import random
from backend.db.firebase_config import questions_collection, users_collection
from backend.models.question import Question

router = APIRouter()

SAMPLE_QUESTIONS = [
    {
        "question": "What is the capital of France?",
        "option1": "London",
        "option2": "Berlin", 
        "option3": "Paris",
        "option4": "Madrid",
        "correct_answer": "Paris",
        "difficulty": "easy"
    },
    {
        "question": "What is 2 + 2?",
        "option1": "3",
        "option2": "4",
        "option3": "5", 
        "option4": "6",
        "correct_answer": "4",
        "difficulty": "easy"
    },
    {
        "question": "What is the chemical symbol for gold?",
        "option1": "Go",
        "option2": "Gd",
        "option3": "Au",
        "option4": "Ag",
        "correct_answer": "Au", 
        "difficulty": "medium"
    },
    {
        "question": "Who wrote 'Romeo and Juliet'?",
        "option1": "Shakespeare",
        "option2": "Dickens",
        "option3": "Hemingway",
        "option4": "Twain",
        "correct_answer": "Shakespeare",
        "difficulty": "medium"
    },
    {
        "question": "What is the speed of light in m/s?",
        "option1": "3x10^6",
        "option2": "3x10^8", 
        "option3": "3x10^10",
        "option4": "3x10^12",
        "correct_answer": "3x10^8",
        "difficulty": "hard"
    }
]

@router.post("/import-from-api")
def import_questions_from_api(request: Request):
    try:
        if questions_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        email = request.headers.get("x-user-email")
        if not email:
            raise HTTPException(status_code=401, detail="Missing user email header")
            
        user_doc = users_collection.document(email).get()
        if not user_doc.exists or user_doc.to_dict().get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")

        print("🔍 Starting API import from Open Trivia DB...")
        
        QUESTIONS_API_URL = "https://opentdb.com/api.php?amount=50&category=18&type=multiple"
        
        response = requests.get(QUESTIONS_API_URL, timeout=30)
        print(f"🔍 API Response Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"🔍 API Error: {response.text}")
            raise HTTPException(status_code=500, detail="Failed to fetch questions from API")
        
        data = response.json()
        api_questions = data.get('results', [])
        print(f"🔍 Received {len(api_questions)} questions from API")
        
        if not api_questions:
            print("🔍 No questions found in API response")
            raise HTTPException(status_code=500, detail="No questions found in API response")
        
        print(f"🔍 First question sample: {api_questions[0].get('question', 'No question text')[:50]}...")
        
        imported_count = 0
        failed_imports = 0
        
        for i, api_question in enumerate(api_questions):
            try:
                print(f"🔍 Processing question {i+1}: {api_question.get('question', 'No question text')[:50]}...")
                
                question_text = html.unescape(api_question['question'])
                correct_answer = html.unescape(api_question['correct_answer'])
                incorrect_answers = [html.unescape(ans) for ans in api_question['incorrect_answers']]
                
                all_options = incorrect_answers + [correct_answer]
                random.shuffle(all_options)
                
                opentdb_difficulty = api_question.get('difficulty', 'medium')
                difficulty_map = {
                    'easy': 'easy',
                    'medium': 'medium', 
                    'hard': 'hard'
                }
                difficulty = difficulty_map.get(opentdb_difficulty, 'medium')
                
                question = Question(
                    question_text=question_text,
                    options=all_options,
                    correct_answer=correct_answer,
                    difficulty=difficulty
                )
                
                if not question.question_text or not question.correct_answer:
                    print(f"🔍 Skipping question {i+1} - missing required fields")
                    failed_imports += 1
                    continue
                
                existing_questions = questions_collection.where(
                    "question_text", "==", question.question_text
                ).get()
                
                if not existing_questions:
                    question_doc = questions_collection.document()
                    question_data = question.dict()
                    if question_data.get("id"):
                        del question_data["id"]
                    question_doc.set(question_data)
                    imported_count += 1
                    print(f"✅ Imported question {i+1}")
                else:
                    print(f"⏭️ Skipping duplicate question {i+1}")
                    failed_imports += 1
                    
            except Exception as e:
                print(f"❌ Error importing question {i+1}: {e}")
                failed_imports += 1
                continue

        print(f"🎉 Import completed: {imported_count} questions imported, {failed_imports} failed")
        
        return {
            "message": f"Successfully imported {imported_count} questions from Open Trivia DB",
            "imported": imported_count,
            "failed": failed_imports,
            "total_available": len(api_questions)
        }
        
    except Exception as e:
        print(f"❌ API import failed: {e}")
        raise HTTPException(status_code=500, detail=f"API import failed: {str(e)}")

@router.post("/import-sample-questions")
def import_sample_questions(request: Request):
    try:
        if questions_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        email = request.headers.get("x-user-email")
        if not email:
            raise HTTPException(status_code=401, detail="Missing user email header")
            
        user_doc = users_collection.document(email).get()
        if not user_doc.exists or user_doc.to_dict().get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")

        imported_count = 0
        
        for sample_question in SAMPLE_QUESTIONS:
            try:
                question = Question(
                    question_text=sample_question['question'],
                    options=[
                        sample_question['option1'],
                        sample_question['option2'],
                        sample_question['option3'],
                        sample_question['option4']
                    ],
                    correct_answer=sample_question['correct_answer'],
                    difficulty=sample_question['difficulty']
                )
                
                existing_questions = questions_collection.where(
                    "question_text", "==", question.question_text
                ).get()
                
                if not existing_questions:
                    question_doc = questions_collection.document()
                    question_data = question.dict()
                    if question_data.get("id"):
                        del question_data["id"]
                    question_doc.set(question_data)
                    imported_count += 1
                    
            except Exception as e:
                print(f"Error importing sample question: {e}")
                continue

        return {
            "message": f"Successfully imported {imported_count} sample questions",
            "imported": imported_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample import failed: {str(e)}")

@router.post("/add")
def add_question(question: Question, request: Request):
    try:
        if questions_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        email = request.headers.get("x-user-email")
        if not email:
            raise HTTPException(status_code=401, detail="Missing user email header")
            
        user_doc = users_collection.document(email).get()
        if not user_doc.exists or user_doc.to_dict().get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")

        question_doc = questions_collection.document()
        question_data = question.dict()
        if question_data.get("id"):
            del question_data["id"]
            
        question_doc.set(question_data)
        return {"id": question_doc.id, **question_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add question: {str(e)}")

@router.get("/by-difficulty/{difficulty}")
def get_questions_by_difficulty(difficulty: str):
    try:
        if questions_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        docs = questions_collection.where("difficulty", "==", difficulty).get()
        questions = []
        for doc in docs:
            question_data = doc.to_dict()
            question_data["id"] = doc.id
            questions.append(question_data)
            
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get questions: {str(e)}")

@router.get("/all")
def list_all_questions(request: Request):
    try:
        if questions_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        # Admin check
        email = request.headers.get("x-user-email")
        if not email:
            raise HTTPException(status_code=401, detail="Missing user email header")
            
        user_doc = users_collection.document(email).get()
        if not user_doc.exists or user_doc.to_dict().get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")

        docs = questions_collection.get()
        questions = []
        for doc in docs:
            question_data = doc.to_dict()
            question_data["id"] = doc.id
            questions.append(question_data)
            
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get questions: {str(e)}")

@router.delete("/{question_id}")
def delete_question(question_id: str, request: Request):
    try:
        if questions_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        email = request.headers.get("x-user-email")
        if not email:
            raise HTTPException(status_code=401, detail="Missing user email header")
            
        user_doc = users_collection.document(email).get()
        if not user_doc.exists or user_doc.to_dict().get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")

        doc_ref = questions_collection.document(question_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Question not found")
            
        doc_ref.delete()
        return {"message": "Question deleted", "id": question_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete question: {str(e)}")