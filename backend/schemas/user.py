# backend/schemas/user.py
from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    username: str
    name: str
    password: str

class UserLogin(BaseModel):
    email: str      # ← принимаем email
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse