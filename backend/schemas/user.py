# backend/schemas/user.py
from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    username: str
    name: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    name: str
    role: str = 'free_user'
    upload_count: int = 0
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class UserRoleUpdate(BaseModel):
    role: str

class UserAdminView(BaseModel):
    id: int
    email: str
    username: str
    name: str
    role: str
    upload_count: int = 0
    created_at: str
