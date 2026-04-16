
import os
from datetime import date

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, Response, JSONResponse

router = APIRouter(tags=["seo"])

SITE_URL: str = os.getenv("SITE_URL", "http://localhost:3000")
SITE_NAME: str = "DataCleaner"
SITE_DESCRIPTION: str = (
    "Сервис автоматической анонимизации изображений с AI-распознаванием лиц. "
    "Защита персональных данных на фотографиях."
)


# ── robots.txt (задание 3.2) ──────────────────────────────────────────────────
@router.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
async def robots_txt() -> PlainTextResponse:
    """
    Правила индексации для поисковых роботов.

    Разрешены для индексации:
      - / (главная, редирект на /login)
      - /login (страница входа и регистрации)

    Исключены из индексации:
      - /upload, /history, /admin (личные кабинеты)
      - /api/, /auth/ (служебные API-пути)
    """
    content = (
        f"User-agent: *\n"
        f"\n"
        f"# Разрешённые публичные страницы\n"
        f"Allow: /$\n"
        f"Allow: /login\n"
        f"\n"
        f"# Закрытые страницы — требуют авторизации\n"
        f"Disallow: /upload\n"
        f"Disallow: /history\n"
        f"Disallow: /admin\n"
        f"\n"
        f"# Служебные API-пути — не для индексации\n"
        f"Disallow: /api/\n"
        f"Disallow: /auth/\n"
        f"Disallow: /image/\n"
        f"Disallow: /geo/\n"
        f"\n"
        f"# Статические ресурсы — разрешены\n"
        f"Allow: /static/\n"
        f"\n"
        f"# Задержка обхода (вежливость к серверу, сек)\n"
        f"Crawl-delay: 10\n"
        f"\n"
        f"# Карта сайта\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n"
    )
    return PlainTextResponse(content=content, media_type="text/plain; charset=utf-8")


# ── sitemap.xml (задание 3.1) ─────────────────────────────────────────────────
@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml() -> Response:
    """
    Карта сайта для поисковых систем.
    Включает только публичные, доступные без авторизации страницы.

    Приоритеты:
      1.0 — /        (главная)
      0.9 — /login   (вход/регистрация — ключевая страница конверсии)
    """
    today = date.today().isoformat()

    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- Главная страница (редирект на /login) — наивысший приоритет -->
  <url>
    <loc>{SITE_URL}/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Страница входа и регистрации — основная публичная страница -->
  <url>
    <loc>{SITE_URL}/login</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>

</urlset>"""

    return Response(
        content=content,
        media_type="application/xml",
        headers={"Content-Type": "application/xml; charset=utf-8"},
    )


# ── JSON-LD структурированные данные (задание 3.4) ────────────────────────────
@router.get("/structured-data.json", include_in_schema=False)
async def structured_data() -> JSONResponse:
    """
    JSON-LD разметка типа SoftwareApplication для главной страницы.
    Используется фронтендом для вставки в <script type="application/ld+json">.
    """
    data = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "SoftwareApplication",
                "@id": f"{SITE_URL}/#software",
                "name": SITE_NAME,
                "description": SITE_DESCRIPTION,
                "url": SITE_URL,
                "applicationCategory": "MultimediaApplication",
                "applicationSubCategory": "Privacy & Security",
                "operatingSystem": "Web Browser",
                "inLanguage": "ru",
                "offers": [
                    {
                        "@type": "Offer",
                        "name": "Бесплатный тариф",
                        "price": "0",
                        "priceCurrency": "RUB",
                        "description": "До 3 изображений бесплатно",
                    },
                    {
                        "@type": "Offer",
                        "name": "Pro тариф",
                        "description": "Неограниченное количество изображений",
                    },
                ],
                "featureList": [
                    "Автоматическое обнаружение лиц с помощью OpenCV AI",
                    "Размытие и пикселизация лиц на изображениях",
                    "Безопасное хранение в S3-совместимом облаке",
                    "Ролевая модель доступа (free / pro / admin)",
                    "История обработанных изображений с фильтрацией",
                ],
                "provider": {
                    "@type": "Organization",
                    "@id": f"{SITE_URL}/#organization",
                    "name": SITE_NAME,
                    "url": SITE_URL,
                },
            },
            {
                "@type": "WebSite",
                "@id": f"{SITE_URL}/#website",
                "url": SITE_URL,
                "name": SITE_NAME,
                "description": SITE_DESCRIPTION,
                "inLanguage": "ru",
            },
        ],
    }
    return JSONResponse(content=data)
