"""
Тесты SEO-эндпоинтов.

Покрывает:
- GET /robots.txt — Content-Type, обязательные директивы
- GET /sitemap.xml — Content-Type, валидный XML, наличие URL
- GET /structured-data.json — JSON-LD, @type SoftwareApplication
"""
import pytest
import xml.etree.ElementTree as ET
from fastapi.testclient import TestClient


class TestRobotsTxt:
    def test_robots_txt_status(self, client: TestClient):
        """robots.txt доступен без авторизации и возвращает 200."""
        resp = client.get("/robots.txt")
        assert resp.status_code == 200

    def test_robots_txt_content_type(self, client: TestClient):
        """Content-Type robots.txt — text/plain."""
        resp = client.get("/robots.txt")
        assert "text/plain" in resp.headers["content-type"]

    def test_robots_txt_has_user_agent(self, client: TestClient):
        """robots.txt содержит директиву User-agent."""
        resp = client.get("/robots.txt")
        assert "User-agent: *" in resp.text

    def test_robots_txt_disallows_api(self, client: TestClient):
        """API-пути закрыты от индексации."""
        resp = client.get("/robots.txt")
        assert "Disallow: /api/" in resp.text

    def test_robots_txt_disallows_upload(self, client: TestClient):
        """Закрытые страницы (/upload, /history, /admin) не индексируются."""
        resp = client.get("/robots.txt")
        assert "Disallow: /upload" in resp.text
        assert "Disallow: /history" in resp.text
        assert "Disallow: /admin" in resp.text

    def test_robots_txt_allows_login(self, client: TestClient):
        """Страница входа разрешена для индексации."""
        resp = client.get("/robots.txt")
        assert "Allow: /login" in resp.text

    def test_robots_txt_has_sitemap_link(self, client: TestClient):
        """robots.txt содержит ссылку на sitemap.xml."""
        resp = client.get("/robots.txt")
        assert "Sitemap:" in resp.text
        assert "sitemap.xml" in resp.text


class TestSitemapXml:
    def test_sitemap_status(self, client: TestClient):
        """sitemap.xml доступен без авторизации и возвращает 200."""
        resp = client.get("/sitemap.xml")
        assert resp.status_code == 200

    def test_sitemap_content_type(self, client: TestClient):
        """Content-Type sitemap.xml — application/xml."""
        resp = client.get("/sitemap.xml")
        assert "xml" in resp.headers["content-type"]

    def test_sitemap_valid_xml(self, client: TestClient):
        """sitemap.xml является валидным XML-документом."""
        resp = client.get("/sitemap.xml")
        try:
            ET.fromstring(resp.text)
        except ET.ParseError as e:
            pytest.fail(f"sitemap.xml содержит невалидный XML: {e}")

    def test_sitemap_contains_root_url(self, client: TestClient):
        """sitemap.xml содержит URL главной страницы."""
        resp = client.get("/sitemap.xml")
        assert "<loc>" in resp.text

    def test_sitemap_has_login_page(self, client: TestClient):
        """sitemap.xml содержит страницу /login."""
        resp = client.get("/sitemap.xml")
        assert "/login" in resp.text

    def test_sitemap_no_private_pages(self, client: TestClient):
        """sitemap.xml НЕ содержит закрытых страниц."""
        resp = client.get("/sitemap.xml")
        assert "/upload" not in resp.text
        assert "/admin" not in resp.text
        assert "/history" not in resp.text

    def test_sitemap_has_priority(self, client: TestClient):
        """sitemap.xml содержит теги priority."""
        resp = client.get("/sitemap.xml")
        assert "<priority>" in resp.text


class TestStructuredData:
    def test_structured_data_status(self, client: TestClient):
        """Эндпоинт JSON-LD доступен и возвращает 200."""
        resp = client.get("/structured-data.json")
        assert resp.status_code == 200

    def test_structured_data_content_type(self, client: TestClient):
        """Content-Type — application/json."""
        resp = client.get("/structured-data.json")
        assert "application/json" in resp.headers["content-type"]

    def test_structured_data_has_context(self, client: TestClient):
        """JSON-LD содержит @context schema.org."""
        data = client.get("/structured-data.json").json()
        assert data["@context"] == "https://schema.org"

    def test_structured_data_has_software_application(self, client: TestClient):
        """Структурированные данные содержат тип SoftwareApplication."""
        data = client.get("/structured-data.json").json()
        graph = data.get("@graph", [])
        types = [item.get("@type") for item in graph]
        assert "SoftwareApplication" in types

    def test_structured_data_has_website(self, client: TestClient):
        """Структурированные данные содержают тип WebSite."""
        data = client.get("/structured-data.json").json()
        graph = data.get("@graph", [])
        types = [item.get("@type") for item in graph]
        assert "WebSite" in types
