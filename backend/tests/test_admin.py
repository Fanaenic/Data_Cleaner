"""
Интеграционные тесты администраторского API.

Покрывает:
- GET /admin/users — только admin, 401 без токена, 403 для обычного пользователя
- PUT /admin/users/{id}/role — смена роли, невалидная роль, несуществующий пользователь
"""
import pytest
from fastapi.testclient import TestClient
from .conftest import get_admin_token, get_user_token, register_user, make_unique_email

ALLOWED_ROLES = ["free_user", "pro_user", "admin"]


class TestListUsers:
    def test_list_users_as_admin(self, client: TestClient):
        """Admin получает список всех пользователей."""
        token = get_admin_token(client)
        resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        users = resp.json()
        assert isinstance(users, list)
        assert len(users) >= 1  # минимум admin
        # Проверяем структуру объекта пользователя
        user = users[0]
        assert "id" in user
        assert "email" in user
        assert "role" in user

    def test_list_users_unauthorized(self, client: TestClient):
        """Запрос без токена возвращает 401."""
        resp = client.get("/admin/users")
        assert resp.status_code == 401

    def test_list_users_as_regular_user(self, client: TestClient):
        """Обычный пользователь (free_user) получает 403."""
        token = get_user_token(client)
        resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403
        assert resp.json()["status_code"] == 403

    def test_list_users_contains_admin(self, client: TestClient):
        """В списке есть хотя бы один admin."""
        token = get_admin_token(client)
        resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        roles = [u["role"] for u in resp.json()]
        assert "admin" in roles


class TestUpdateUserRole:
    def _get_non_admin_user_id(self, client: TestClient, admin_token: str) -> int:
        """Создаёт обычного пользователя и возвращает его ID."""
        data = register_user(client)
        token = data["access_token"]
        # Получаем список пользователей и ищем только что созданного
        users_resp = client.get(
            "/admin/users", headers={"Authorization": f"Bearer {admin_token}"}
        )
        email = data["user"]["email"]
        for u in users_resp.json():
            if u["email"] == email:
                return u["id"]
        raise AssertionError("Created user not found in admin list")

    def test_update_role_success(self, client: TestClient):
        """Admin успешно меняет роль пользователя."""
        admin_token = get_admin_token(client)
        user_id = self._get_non_admin_user_id(client, admin_token)

        resp = client.put(
            f"/admin/users/{user_id}/role",
            json={"role": "pro_user"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "pro_user"

    def test_update_role_invalid_role(self, client: TestClient):
        """Недопустимая роль возвращает 400."""
        admin_token = get_admin_token(client)
        user_id = self._get_non_admin_user_id(client, admin_token)

        resp = client.put(
            f"/admin/users/{user_id}/role",
            json={"role": "superuser"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 400

    def test_update_role_user_not_found(self, client: TestClient):
        """Несуществующий пользователь возвращает 404."""
        admin_token = get_admin_token(client)
        resp = client.put(
            "/admin/users/99999/role",
            json={"role": "pro_user"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 404

    def test_update_role_unauthorized(self, client: TestClient):
        """Без токена возвращает 401."""
        resp = client.put("/admin/users/1/role", json={"role": "pro_user"})
        assert resp.status_code == 401

    def test_update_role_as_regular_user(self, client: TestClient):
        """Обычный пользователь получает 403."""
        user_token = get_user_token(client)
        resp = client.put(
            "/admin/users/1/role",
            json={"role": "pro_user"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert resp.status_code == 403
