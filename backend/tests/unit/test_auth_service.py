"""
Модульные тесты сервисного слоя аутентификации.

Покрывает:
- AuthService.hash_password / verify_password
- AuthService.create_access_token
- AuthService.create_user
- AuthService.authenticate_user
"""
import os
import sys
import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests/test_datacleaner.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-32chars!!")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.local")
os.environ.setdefault("ADMIN_USERNAME", "testadmin")
os.environ.setdefault("ADMIN_NAME", "Test Admin")
os.environ.setdefault("ADMIN_PASSWORD", "AdminPass123!")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import jwt
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from services.auth_service import AuthService
from core import SECRET_KEY, ALGORITHM


class TestPasswordHashing:
    def test_hash_password_returns_string(self):
        """hash_password возвращает строку."""
        hashed = AuthService.hash_password("MyPassword123!")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_is_not_plaintext(self):
        """Хеш не равен исходному паролю."""
        password = "MyPassword123!"
        hashed = AuthService.hash_password(password)
        assert hashed != password

    def test_verify_correct_password(self):
        """Верный пароль проходит проверку."""
        password = "CorrectPassword123!"
        hashed = AuthService.hash_password(password)
        assert AuthService.verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        """Неверный пароль не проходит проверку."""
        hashed = AuthService.hash_password("OriginalPassword123!")
        assert AuthService.verify_password("WrongPassword!", hashed) is False

    def test_same_password_different_hashes(self):
        """Два хеша одного пароля различны (salt)."""
        password = "SamePassword123!"
        hash1 = AuthService.hash_password(password)
        hash2 = AuthService.hash_password(password)
        assert hash1 != hash2
        # Оба должны верифицироваться
        assert AuthService.verify_password(password, hash1) is True
        assert AuthService.verify_password(password, hash2) is True


class TestAccessToken:
    def test_create_access_token_returns_string(self):
        """create_access_token возвращает JWT строку."""
        token = AuthService.create_access_token(data={"sub": "test@example.com"})
        assert isinstance(token, str)
        assert token.count(".") == 2  # JWT имеет 3 части, разделённые точками

    def test_access_token_contains_email(self):
        """JWT содержит email в payload."""
        email = "user@example.com"
        token = AuthService.create_access_token(data={"sub": email})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == email

    def test_access_token_has_expiry(self):
        """JWT содержит поле exp (время истечения)."""
        token = AuthService.create_access_token(data={"sub": "test@example.com"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload
        assert payload["exp"] > datetime.utcnow().timestamp()

    def test_access_token_type_is_access(self):
        """JWT содержит type='access'."""
        token = AuthService.create_access_token(data={"sub": "test@example.com"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload.get("type") == "access"


class TestCreateUser:
    def test_create_user_success(self):
        """Создание нового пользователя возвращает UserResponse."""
        from schemas.user import UserCreate

        mock_db = MagicMock()

        with patch("services.auth_service.UserRepository") as MockRepo:
            mock_repo_instance = MockRepo.return_value
            mock_repo_instance.get_by_email_or_username.return_value = None
            mock_repo_instance.get_admin.return_value = MagicMock()  # admin существует

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.email = "new@test.local"
            mock_user.username = "newuser"
            mock_user.name = "New User"
            mock_user.role = "free_user"
            mock_user.upload_count = 0
            mock_user.created_at = datetime(2024, 1, 1)
            mock_repo_instance.create.return_value = mock_user

            user_data = UserCreate(
                email="new@test.local",
                username="newuser",
                name="New User",
                password="Pass123!",
            )
            result = AuthService.create_user(mock_db, user_data)

        assert result.email == "new@test.local"
        assert result.role == "free_user"

    def test_create_user_duplicate_email_raises(self):
        """Дубль email вызывает HTTPException 400."""
        from schemas.user import UserCreate
        from fastapi import HTTPException

        mock_db = MagicMock()

        with patch("services.auth_service.UserRepository") as MockRepo:
            existing = MagicMock()
            existing.email = "dup@test.local"
            MockRepo.return_value.get_by_email_or_username.return_value = existing

            with pytest.raises(HTTPException) as exc_info:
                AuthService.create_user(
                    mock_db,
                    UserCreate(
                        email="dup@test.local",
                        username="dupuser",
                        name="Dup",
                        password="Pass123!",
                    ),
                )

        assert exc_info.value.status_code == 400


class TestAuthenticateUser:
    def test_authenticate_success(self):
        """Верные кредялы возвращают UserResponse."""
        mock_db = MagicMock()

        with patch("services.auth_service.UserRepository") as MockRepo:
            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.email = "auth@test.local"
            mock_user.username = "authuser"
            mock_user.name = "Auth User"
            mock_user.role = "free_user"
            mock_user.upload_count = 0
            mock_user.created_at = datetime(2024, 1, 1)
            mock_user.hashed_password = AuthService.hash_password("Pass123!")
            MockRepo.return_value.get_by_email.return_value = mock_user

            result = AuthService.authenticate_user(mock_db, "auth@test.local", "Pass123!")

        assert result is not None
        assert result.email == "auth@test.local"

    def test_authenticate_wrong_password_returns_none(self):
        """Неверный пароль возвращает None."""
        mock_db = MagicMock()

        with patch("services.auth_service.UserRepository") as MockRepo:
            mock_user = MagicMock()
            mock_user.hashed_password = AuthService.hash_password("CorrectPass123!")
            MockRepo.return_value.get_by_email.return_value = mock_user

            result = AuthService.authenticate_user(mock_db, "user@test.local", "WrongPass!")

        assert result is None

    def test_authenticate_nonexistent_user_returns_none(self):
        """Несуществующий email возвращает None."""
        mock_db = MagicMock()

        with patch("services.auth_service.UserRepository") as MockRepo:
            MockRepo.return_value.get_by_email.return_value = None
            result = AuthService.authenticate_user(mock_db, "ghost@test.local", "Pass123!")

        assert result is None
