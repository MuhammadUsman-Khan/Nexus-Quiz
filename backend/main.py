from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes import user, quiz, question, result

app = FastAPI(title="Adaptive Quiz Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user.router, prefix="/api/users", tags=["users"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(question.router, prefix="/api/questions", tags=["questions"])
app.include_router(result.router, prefix="/api/results", tags=["results"])

@app.get("/")
async def root():
    return {"message": "Adaptive Quiz Platform API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)