"""
GeoService — интеграция с ip-api.com для геолокации по IP.

Задание 5 (Лаб. 4):
  5.1 — сценарий: показ местоположения сессии пользователя как функция безопасности
  5.2 — серверный слой интеграции (service/adapter)
  5.3 — API-ключ через переменную окружения IPAPI_KEY
  5.4 — таймауты, повторные попытки, ограничение частоты (rate limiting)
  5.5 — нормализация ответа в формат приложения

Используемое API: ip-api.com (бесплатный tier, без ключа; pro-tier c ключом IPAPI_KEY)
Документация: https://ip-api.com/docs/api:json
"""
import os
import logging
import asyncio
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ── Конфигурация из переменных окружения ────────────────────────────────────
IPAPI_KEY: str = os.getenv("IPAPI_KEY", "")
IPAPI_TIMEOUT: float = float(os.getenv("IPAPI_TIMEOUT", "5.0"))
IPAPI_MAX_RETRIES: int = int(os.getenv("IPAPI_MAX_RETRIES", "3"))
IPAPI_RETRY_DELAY: float = float(os.getenv("IPAPI_RETRY_DELAY", "1.0"))

# Поля, которые запрашиваем у API
_FIELDS = (
    "status,message,country,countryCode,region,"
    "regionName,city,zip,lat,lon,timezone,isp,org,as,query"
)


# ── Формирование URL ─────────────────────────────────────────────────────────
def _build_url(ip: Optional[str] = None) -> str:
    """Формирует URL для запроса к ip-api.com.

    Если задан IPAPI_KEY — используется pro-endpoint (HTTPS + без ограничений).
    Иначе — бесплатный HTTP-endpoint (45 запросов/мин).
    """
    target = f"/{ip}" if ip else ""
    if IPAPI_KEY:
        return f"https://pro.ip-api.com/json{target}?key={IPAPI_KEY}&fields={_FIELDS}"
    return f"http://ip-api.com/json{target}?fields={_FIELDS}"


# ── Нормализация ответа (задание 5.5) ────────────────────────────────────────
def _normalize(data: dict) -> dict:
    """Преобразует сырой ответ ip-api.com в единый формат приложения."""
    if data.get("status") != "success":
        return {
            "available": False,
            "error": data.get("message", "Unknown error from geo API"),
        }
    return {
        "available": True,
        "ip": data.get("query", ""),
        "country": data.get("country", ""),
        "country_code": data.get("countryCode", ""),
        "region": data.get("regionName", ""),
        "city": data.get("city", ""),
        "zip": data.get("zip", ""),
        "latitude": data.get("lat"),
        "longitude": data.get("lon"),
        "timezone": data.get("timezone", ""),
        "isp": data.get("isp", ""),
        "org": data.get("org", ""),
    }


# ── Основная функция (задание 5.4: таймаут + retry + rate limit) ─────────────
async def get_geo_info(ip: Optional[str] = None) -> dict:
    """Возвращает геолокацию по IP с обработкой ошибок и повторными попытками.

    Args:
        ip: IPv4/IPv6 адрес. None → ip-api определит IP самостоятельно.

    Returns:
        Нормализованный словарь с геоданными.
        При любой ошибке возвращает {"available": False, "error": "..."}.
    """
    url = _build_url(ip)

    for attempt in range(1, IPAPI_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=IPAPI_TIMEOUT) as client:
                response = await client.get(url)

                # Ограничение частоты (rate limiting)
                if response.status_code == 429:
                    logger.warning(
                        "ip-api.com: превышен лимит запросов (429). "
                        "Используйте IPAPI_KEY для pro-tier."
                    )
                    return {
                        "available": False,
                        "error": "Rate limit exceeded. Try again later.",
                    }

                response.raise_for_status()
                data = response.json()
                result = _normalize(data)
                logger.debug(f"ip-api.com: успешный ответ для IP={ip or 'auto'}")
                return result

        except httpx.TimeoutException:
            logger.warning(
                f"ip-api.com: таймаут на попытке {attempt}/{IPAPI_MAX_RETRIES} "
                f"(IP={ip or 'auto'})"
            )
            if attempt < IPAPI_MAX_RETRIES:
                await asyncio.sleep(IPAPI_RETRY_DELAY * attempt)

        except httpx.HTTPStatusError as exc:
            logger.error(f"ip-api.com: HTTP {exc.response.status_code}")
            return {"available": False, "error": f"HTTP error {exc.response.status_code}"}

        except httpx.RequestError as exc:
            logger.error(f"ip-api.com: ошибка соединения: {exc}")
            if attempt < IPAPI_MAX_RETRIES:
                await asyncio.sleep(IPAPI_RETRY_DELAY * attempt)

        except Exception as exc:
            logger.exception(f"ip-api.com: непредвиденная ошибка: {exc}")
            if attempt < IPAPI_MAX_RETRIES:
                await asyncio.sleep(IPAPI_RETRY_DELAY * attempt)

    # Graceful degradation — не ломаем приложение, просто сообщаем о недоступности
    logger.error(
        f"ip-api.com: сервис недоступен после {IPAPI_MAX_RETRIES} попыток"
    )
    return {
        "available": False,
        "error": f"Geo service unavailable after {IPAPI_MAX_RETRIES} retries",
    }
