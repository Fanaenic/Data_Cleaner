import os
import sys
import logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from api import router
from core import (engine, Base, UPLOADS_DIR, SessionLocal,
                  DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_USERNAME,
                  DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_PASSWORD)
from models import User
from services import AuthService
from dependencies import get_current_user

Base.metadata.create_all(bind=engine)

# Миграция: добавляем колонку role если её ещё нет
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user' NOT NULL"))
        conn.commit()
    except Exception:
        pass  # Колонка уже существует

# Миграция: добавляем колонку upload_count если её ещё нет
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN upload_count INTEGER DEFAULT 0 NOT NULL"))
        conn.commit()
    except Exception:
        pass  # Колонка уже существует

# Миграция: переименовываем роль 'user' -> 'free_user'
with engine.connect() as conn:
    conn.execute(text("UPDATE users SET role='free_user' WHERE role='user'"))
    conn.commit()


def create_default_admin() -> None:
    """Создаёт admin-пользователя при старте, если ни одного admin ещё нет."""
    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(User.role == 'admin').first()
        if admin_exists:
            return

        hashed_password = AuthService.hash_password(DEFAULT_ADMIN_PASSWORD)
        admin = User(
            email=DEFAULT_ADMIN_EMAIL,
            username=DEFAULT_ADMIN_USERNAME,
            name=DEFAULT_ADMIN_NAME,
            hashed_password=hashed_password,
            role='admin'
        )
        db.add(admin)
        db.commit()
        logging.getLogger(__name__).info(
            f"Default admin created: email={DEFAULT_ADMIN_EMAIL}, password={DEFAULT_ADMIN_PASSWORD}"
        )
    finally:
        db.close()


create_default_admin()

app = FastAPI(title="DataCleaner API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "datacleaner"}


@app.get("/profile")
async def get_profile(current_user=Depends(get_current_user)):
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
