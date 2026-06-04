"""
Тесты геолокационного эндпоинта.

Покрывает:
- GET /geo/location — требует авторизации
- Успешный ответ с моком geo_service
- Graceful degradation при недоступном внешнем API
"""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from .conftest import get_user_token


class TestGeoLocation:
    def test_geo_unauthorized(self, client: TestClient):
        """Запрос без токена возвращает 401."""
        resp = client.get("/geo/location")
        assert resp.status_code == 401

    def test_geo_success(self, client: TestClient):
        """При успешном ответе внешнего API возвращает геоданные."""
        token = get_user_token(client)
        mock_geo = {
            "available": True,
            "ip": "95.24.100.1",
            "country": "Russia",
            "country_code": "RU",
            "region": "Moscow",
            "city": "Moscow",
            "timezone": "Europe/Moscow",
            "isp": "Test ISP",
        }

        with patch(
            "api.geo.get_geo_info",
            new_callable=AsyncMock,
            return_value=mock_geo,
        ):
            resp = client.get(
                "/geo/location",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["available"] is True
        assert data["country"] == "Russia"
        assert data["city"] == "Moscow"

    def test_geo_graceful_degradation(self, client: TestClient):
        """При недоступном API возвращает available=false (не 500)."""
        token = get_user_token(client)
        mock_degraded = {"available": False, "error": "Geo service unavailable"}

        with patch(
            "api.geo.get_geo_info",
            new_callable=AsyncMock,
            return_value=mock_degraded,
        ):
            resp = client.get(
                "/geo/location",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert resp.status_code == 200  # НЕ 500 — graceful degradation
        data = resp.json()
        assert data["available"] is False

    def test_geo_response_structure(self, client: TestClient):
        """Успешный ответ содержит ожидаемые поля."""
        token = get_user_token(client)
        mock_geo = {
            "available": True,
            "ip": "1.2.3.4",
            "country": "Test Country",
            "country_code": "TC",
            "region": "Test Region",
            "city": "Test City",
            "timezone": "UTC",
            "isp": "Test ISP",
        }

        with patch(
            "api.geo.get_geo_info",
            new_callable=AsyncMock,
            return_value=mock_geo,
        ):
            resp = client.get(
                "/geo/location",
                headers={"Authorization": f"Bearer {token}"},
            )

        data = resp.json()
        expected_fields = {"available", "ip", "country", "city", "timezone", "isp"}
        for field in expected_fields:
            assert field in data, f"Поле '{field}' отсутствует в ответе"
