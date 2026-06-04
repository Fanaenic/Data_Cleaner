"""
Интеграционные тесты аутентификации.

Покрывает:
- POST /auth/register — успех, дубль email, дубль username
- POST /auth/login — успех, неверный пароль, несуществующий email
- POST /auth/refresh — успех, невалидный токен
- POST /auth/logout — успех
- GET /auth/me — успех, без токена
"""
import pytest
from fastapi.testclient import TestClient
from .conftest import get_admin_token, make_unique_email, register_user


class TestRegister:
    def test_register_success(self, client: TestClient):
        """Новый пользователь успешно регистрируется."""
        email = make_unique_email()
        resp = client.post("/auth/register", json={
            "email": email,
            "username": f"user_{email[:8]}",
            "name": "Test User",
            "password": "TestPass123!",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "free_user"

    def test_register_duplicate_email(self, client: TestClient):
        """Повторная регистрация с тем же email возвращает 400."""
        email = make_unique_email()
        client.post("/auth/register", json={
            "email": email, "username": "user_first",
            "name": "First", "password": "Pass123!"
        })
        resp = client.post("/auth/register", json={
            "email": email, "username": "user_second",
            "name": "Second", "password": "Pass123!"
        })
        assert resp.status_code == 400
        assert "Email already registered" in resp.json()["detail"]

    def test_register_duplicate_username(self, client: TestClient):
        """Повторная регистрация с тем же username возвращает 400."""
        username = f"dupuser_{make_unique_email()[:8]}"
        client.post("/auth/register", json={
            "email": make_unique_email(), "username": username,
            "name": "First", "password": "Pass123!"
        })
        resp = client.post("/auth/register", json={
            "email": make_unique_email(), "username": username,
            "name": "Second", "password": "Pass123!"
        })
        assert resp.status_code == 400
        assert "Username already taken" in resp.json()["detail"]

    def test_register_missing_fields(self, client: TestClient):
        """Запрос без обязательных полей возвращает 422."""
        resp = client.post("/auth/register", json={"email": "incomplete@test.local"})
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client: TestClient):
        """Вход с корректными данными возвращает токены."""
        email = make_unique_email()
        password = "LoginTest123!"
        register_user(client, email, password)

        resp = client.post("/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_wrong_password(self, client: TestClient):
        """Неверный пароль возвращает 401."""
        email = make_unique_email()
        register_user(client, email, "CorrectPass123!")

        resp = client.post("/auth/login", json={"email": email, "password": "WrongPass123!"})
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient):
        """Несуществующий email возвращает 401."""
        resp = client.post("/auth/login", json={
            "email": "nobody@notexist.local", "password": "AnyPass123!"
        })
        assert resp.status_code == 401

    def test_admin_login(self, client: TestClient):
        """Admin может войти с предустановленными кредами."""
        token = get_admin_token(client)
        assert token is not None
        assert len(token) > 10


class TestTokenRefresh:
    def test_refresh_success(self, client: TestClient):
        """Обновление токена по refresh_token возвращает новую пару."""
        data = register_user(client)
        refresh_token = data["refresh_token"]

        resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        new_data = resp.json()
        assert "access_token" in new_data
        assert "refresh_token" in new_data
        # Старый refresh токен должен быть инвалидирован
        resp2 = client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp2.status_code == 401

    def test_refresh_invalid_token(self, client: TestClient):
        """Неверный refresh token возвращает 401."""
        resp = client.post("/auth/refresh", json={"refresh_token": "invalid.token.here"})
        assert resp.status_code == 401

    def test_refresh_missing_token(self, client: TestClient):
        """Запрос без refresh token возвращает 422."""
        resp = client.post("/auth/refresh", json={})
        assert resp.status_code == 422


class TestLogout:
    def test_logout_success(self, client: TestClient):
        """Выход инвалидирует refresh token."""
        data = register_user(client)
        refresh_token = data["refresh_token"]

        resp = client.post("/auth/logout", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        assert "message" in resp.json()

        # После logout refresh token недействителен
        resp2 = client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp2.status_code == 401

    def test_logout_invalid_token_still_200(self, client: TestClient):
        """Logout с уже невалидным токеном — всё равно 200 (idempotent)."""
        resp = client.post("/auth/logout", json={"refresh_token": "invalid.token"})
        assert resp.status_code == 200


class TestGetMe:
    def test_get_me_success(self, client: TestClient):
        """Авторизованный пользователь получает свои данные."""
        data = register_user(client)
        token = data["access_token"]

        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        me = resp.json()
        assert "email" in me
        assert "role" in me

    def test_get_me_unauthorized(self, client: TestClient):
        """Запрос без токена возвращает 401."""
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_get_me_invalid_token(self, client: TestClient):
        """Запрос с невалидным токеном возвращает 401."""
        resp = client.get("/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
        assert resp.status_code == 401
