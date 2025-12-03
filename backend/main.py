import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from jwt.exceptions import InvalidTokenError
import jwt

from api import router
from core import engine, Base, SECRET_KEY, ALGORITHM, oauth2_scheme, get_db, UPLOADS_DIR
from models import User
from schemas.user import UserResponse
from services import AuthService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataCleaner API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserResponse:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        name=user.name,
        created_at=user.created_at.isoformat()
    )

AuthService.get_current_user = staticmethod(get_current_user)

app.include_router(router)

# ДОБАВЬТЕ ЭТИ ЭНДПОИНТЫ
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "datacleaner"}

@app.get("/profile")
async def get_profile(current_user = Depends(get_current_user)):
    """Получить профиль текущего пользователя"""
    return current_user

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app=app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )