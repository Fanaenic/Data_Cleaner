"""
GeoAPI — эндпоинт геолокации текущего пользователя.

Задание 5 (Лаб. 4):
  5.2 — серверный слой интеграции (adapter) в FastAPI
  6.1 — данные передаются на фронтенд для отображения в SecurityWidget
  6.3 — graceful degradation: при недоступности ip-api.com возвращает
         {"available": false} вместо ошибки 500

Требует авторизации — геоданные сессии видит только сам пользователь.
"""
import logging

from fastapi import APIRouter, Depends, Request

from dependencies import get_current_user
from services.geo_service import get_geo_info

logger = logging.getLogger(__name__)

router = APIRouter(tags=["geo"])


@router.get(
    "/location",
    summary="Геолокация текущей сессии",
    description=(
        "Возвращает геолокацию по IP клиента. "
        "Используется как информация о безопасности сессии. "
        "При недоступности внешнего API возвращает {available: false}."
    ),
    responses={
        200: {
            "description": "Геоданные (или сообщение о недоступности)",
            "content": {
                "application/json": {
                    "examples": {
                        "success": {
                            "summary": "Успешный ответ",
                            "value": {
                                "available": True,
                                "ip": "95.24.100.1",
                                "country": "Russia",
                                "country_code": "RU",
                                "region": "Moscow",
                                "city": "Moscow",
                                "timezone": "Europe/Moscow",
                                "isp": "PJSC MegaFon",
                            },
                        },
                        "degraded": {
                            "summary": "Внешний API недоступен (graceful degradation)",
                            "value": {
                                "available": False,
                                "error": "Geo service unavailable after 3 retries",
                            },
                        },
                    }
                }
            },
        },
        401: {"description": "Не авторизован"},
    },
)
async def get_user_location(
    request: Request,
    current_user=Depends(get_current_user),
) -> dict:
    """
    Определяет IP клиента (с учётом прокси/Docker-сети)
    и запрашивает геолокацию через ip-api.com.

    Для локальных IP (127.0.0.1, ::1) — передаётся None,
    чтобы ip-api.com определил публичный IP сервера.
    """
    # Извлекаем реальный IP клиента (с учётом X-Forwarded-For от прокси/nginx)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Берём первый IP в цепочке (исходный клиент)
        client_ip: str | None = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else None

    # Для loopback-адресов передаём None → ip-api определит публичный IP
    if client_ip in ("127.0.0.1", "::1", "localhost", None):
        logger.debug("Локальный IP — запрашиваем геолокацию без явного IP")
        client_ip = None

    logger.debug(f"Запрос геолокации для IP={client_ip or 'auto'}, user_id={current_user.id}")
    return await get_geo_info(client_ip)
