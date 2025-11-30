# backend/main.py
import os
from datetime import datetime, timedelta
from typing import Dict
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from jwt.exceptions import InvalidTokenError
import jwt
from backend.api import router
from backend.core import engine, Base, SECRET_KEY, ALGORITHM, oauth2_scheme, get_db
from backend.models import User
from backend.schemas.user import UserResponse
from backend.services import AuthService

# Создаём таблицы
Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataCleaner API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статика для изображений
from backend.core import UPLOADS_DIR
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Метод для получения текущего пользователя (для роутеров вне auth)
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

# Делаем метод доступным в auth_service
AuthService.get_current_user = staticmethod(get_current_user)

# Подключаем роутеры
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app=app,
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )