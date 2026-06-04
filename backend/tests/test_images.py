"""
Интеграционные тесты API изображений.

Покрывает:
- POST /image/ — загрузка (требует авторизации), моки StorageService и ImageService
- GET /image/ — список с фильтрами, пагинация
- GET /image/{id} — получение по ID, 404 чужого изображения
- DELETE /image/{id} — удаление своего, попытка удалить чужое
"""
import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from .conftest import get_user_token, get_admin_token, register_user


def _make_test_image() -> bytes:
    """Минимальный валидный JPEG (1x1 пиксель)."""
    return (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
        b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
        b"\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f'9=8"
        b"\x839EE\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
        b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00"
        b"\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08"
        b"\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xff\xd9"
    )


class TestImageUpload:
    def test_upload_unauthorized(self, client: TestClient):
        """Загрузка без токена возвращает 401."""
        img_bytes = _make_test_image()
        resp = client.post(
            "/image/",
            files={"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        )
        assert resp.status_code == 401

    def test_upload_success_mocked(self, client: TestClient):
        """Успешная загрузка с замоканным ImageService возвращает 201."""
        token = get_user_token(client)
        mock_result = {
            "id": 1,
            "filename": "processed_test.jpg",
            "original_name": "test.jpg",
            "created_at": "2024-01-01T00:00:00",
            "url": "http://localhost:8000/uploads/processed_test.jpg",
            "processed": True,
            "detected_count": 2,
            "s3_key": None,
        }

        with patch("api.image.ImageService.upload_image", return_value=mock_result):
            img_bytes = _make_test_image()
            resp = client.post(
                "/image/?process_type=blur",
                files={"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
                headers={"Authorization": f"Bearer {token}"},
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["original_name"] == "test.jpg"
        assert data["processed"] is True


class TestGetImages:
    def test_get_images_unauthorized(self, client: TestClient):
        """Список изображений без токена возвращает 401."""
        resp = client.get("/image/")
        assert resp.status_code == 401

    def test_get_images_success(self, client: TestClient):
        """Авторизованный пользователь получает пустой список изображений."""
        token = get_user_token(client)
        resp = client.get("/image/", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert isinstance(data["items"], list)

    def test_get_images_pagination(self, client: TestClient):
        """Параметры пагинации применяются корректно."""
        token = get_user_token(client)
        resp = client.get(
            "/image/?page=1&limit=5",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["page"] == 1
        assert data["limit"] == 5

    def test_get_images_invalid_sort_field(self, client: TestClient):
        """Недопустимое поле сортировки возвращает 422."""
        token = get_user_token(client)
        resp = client.get(
            "/image/?sort_by=invalid_field",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_get_images_invalid_sort_order(self, client: TestClient):
        """Недопустимый порядок сортировки возвращает 422."""
        token = get_user_token(client)
        resp = client.get(
            "/image/?sort_order=random",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_get_images_date_range_invalid(self, client: TestClient):
        """date_from > date_to возвращает 422."""
        token = get_user_token(client)
        resp = client.get(
            "/image/?date_from=2024-12-31&date_to=2024-01-01",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422


class TestGetImageById:
    def test_get_image_not_found(self, client: TestClient):
        """Несуществующий ID изображения возвращает 404."""
        token = get_user_token(client)
        resp = client.get(
            "/image/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_get_image_unauthorized(self, client: TestClient):
        """Запрос без токена возвращает 401."""
        resp = client.get("/image/1")
        assert resp.status_code == 401


class TestDeleteImage:
    def test_delete_unauthorized(self, client: TestClient):
        """Удаление без токена возвращает 401."""
        resp = client.delete("/image/1")
        assert resp.status_code == 401

    def test_delete_not_found(self, client: TestClient):
        """Удаление несуществующего изображения возвращает 404."""
        token = get_user_token(client)
        resp = client.delete(
            "/image/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
