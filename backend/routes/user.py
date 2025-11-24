from fastapi import APIRouter, HTTPException
from fastapi import Body
from backend.db.firebase_config import users_collection
from backend.models.user import User
import hashlib
import secrets

router = APIRouter()

def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 200_000)
    return f"{salt.hex()}${dk.hex()}"

def _check_password(password: str, hashed: str) -> bool:
    try:
        parts = hashed.split('$')
        if len(parts) != 2:
            return False
        salt_hex, hash_hex = parts
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 200_000)
        return secrets.compare_digest(dk, expected)
    except Exception:
        return False

@router.post("/register")
def register_user(user: User = Body(...)):
    try:
        if users_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        user_doc = users_collection.document(user.email)
        if user_doc.get().exists:
            raise HTTPException(status_code=400, detail="User already exists")
            
        data = user.dict()
        pwd = data.pop('password', None)
        if pwd:
            data['password_hash'] = _hash_password(pwd)

        user_doc.set(data)
        safe = {k: v for k, v in data.items() if k != 'password_hash'}
        return {"id": user_doc.id, **safe}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post('/login')
def login(payload: dict = Body(...)):
    try:
        if users_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        email = payload.get('email')
        password = payload.get('password')
        if not email or not password:
            raise HTTPException(status_code=400, detail='email and password required')
            
        user_doc = users_collection.document(email).get()
        if not user_doc.exists:
            raise HTTPException(status_code=401, detail='Invalid credentials')
            
        data = user_doc.to_dict()
        hashed = data.get('password_hash')
        if not hashed or not _check_password(password, hashed):
            raise HTTPException(status_code=401, detail='Invalid credentials')
            
        safe = {k: v for k, v in data.items() if k != 'password_hash'}
        return {"id": user_doc.id, **safe}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@router.get("/{email}")
def get_user(email: str):
    try:
        if users_collection is None:
            raise HTTPException(status_code=500, detail="Database not initialized")
            
        user_doc = users_collection.document(email).get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
            
        data = user_doc.to_dict()
        data.pop('password_hash', None)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user: {str(e)}")