from fastapi import APIRouter, HTTPException, Request
from backend.db.firebase_config import results_collection, users_collection
import asyncio

router = APIRouter()

@router.post("/submit")
async def submit_result(request: Request):
    try:
        if results_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        payload = await request.json()
        result_doc = results_collection.document()
        result_doc.set(payload)
        return {"id": result_doc.id, **payload}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit result: {str(e)}")

@router.get("/user/{email}")
def get_user_results(email: str):
    try:
        if results_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        result_docs = results_collection.where("user_id", "==", email).get()
        results = []
        for doc in result_docs:
            data = doc.to_dict()
            ts = data.get('timestamp')
            if hasattr(ts, 'isoformat'):
                data['timestamp'] = ts.isoformat()
            results.append({"id": doc.id, **data})
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get results: {str(e)}")

@router.get("/all")
def get_all_results(request: Request):
    try:
        if results_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        email = request.headers.get("x-user-email")
        if not email:
            raise HTTPException(status_code=401, detail="Missing user email header")
            
        user_doc = users_collection.document(email).get()
        if not user_doc.exists or user_doc.to_dict().get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")

        docs = results_collection.get()
        out = []
        for doc in docs:
            data = doc.to_dict()
            ts = data.get('timestamp')
            if hasattr(ts, 'isoformat'):
                data['timestamp'] = ts.isoformat()
            out.append({"id": doc.id, **data})
            
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get results: {str(e)}")