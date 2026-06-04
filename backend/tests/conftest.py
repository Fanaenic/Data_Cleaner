"""
Конфигурация тестового окружения.

ВАЖНО: переменные окружения устанавливаются ДО импорта модулей приложения,
чтобы core/__init__.py создал engine с тестовой БД.
"""
import os
import sys

# ── Тестовые переменные окружения (ОБЯЗАТЕЛЬНО до импорта модулей приложения) ─
os.environ.setdefault("DATABASE_URL", "sqlite:///./tests/test_datacleaner.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-32chars!!")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.local")
os.environ.setdefault("ADMIN_USERNAME", "testadmin")
os.environ.setdefault("ADMIN_NAME", "Test Admin")
os.environ.setdefault("ADMIN_PASSWORD", "AdminPass123!")
os.environ.setdefault("SITE_URL", "http://localhost:3000")
os.environ.setdefault("S3_ENDPOINT", "http://localhost:9000")
os.environ.setdefault("S3_BUCKET", "test-bucket")

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Импортируем приложение ПОСЛЕ установки переменных
from main import app
from core import get_db, engine

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Переопределяем зависимость БД для тестов."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def client():
    """Тестовый HTTP-клиент (один на сессию)."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def clean_db_between_tests():
    """Очистка не-admin пользователей и связанных данных между тестами."""
    yield
    db = TestingSessionLocal()
    try:
        db.execute(text("DELETE FROM refresh_tokens"))
        db.execute(text("DELETE FROM images"))
        db.execute(text("DELETE FROM users WHERE role != 'admin'"))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


# ── Вспомогательные функции ───────────────────────────────────────────────────

def make_unique_email() -> str:
    return f"user_{uuid.uuid4().hex[:8]}@test.local"


def register_user(client: TestClient, email: str = None, password: str = "TestPass123!") -> dict:
    """Регистрирует тестового пользователя и возвращает данные ответа."""
    if email is None:
        email = make_unique_email()
    resp = client.post("/auth/register", json={
        "email": email,
        "username": email.split("@")[0],
        "name": "Test User",
        "password": password,
    })
    return resp.json()


def get_user_token(client: TestClient) -> str:
    """Регистрирует пользователя и возвращает access token."""
    data = register_user(client)
    return data["access_token"]


def get_admin_token(client: TestClient) -> str:
    """Логинится как admin и возвращает access token."""
    resp = client.post("/auth/login", json={
        "email": "admin@test.local",
        "password": "AdminPass123!",
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.json()}"
    return resp.json()["access_token"]
