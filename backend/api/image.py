import json
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, status
from sqlalchemy.orm import Session

from core import get_db
from dependencies import get_current_user
from schemas.image import ImageResponse, PaginatedImageResponse
from schemas.user import UserResponse
from services import ImageService
from services.storage_service import StorageService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
        file: UploadFile = File(...),
        process_type: str = Query("blur", description="Тип обработки: blur, pixelate, none"),
        current_user: UserResponse = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    """Загрузка изображения с AI-обработкой и сохранением в S3."""
    try:
        result = ImageService.upload_image(
            file=file,
            current_user=current_user,
            db=db,
            process_type=process_type,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка загрузки изображения: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки изображения: {str(e)}",
        )


@router.get("/", response_model=PaginatedImageResponse)
async def get_user_images(
        search: Optional[str] = Query(None, description="Поиск по названию файла"),
        processed: Optional[bool] = Query(None, description="Фильтр: обработано (true/false)"),
        date_from: Optional[date] = Query(None, description="Дата загрузки от (YYYY-MM-DD)"),
        date_to: Optional[date] = Query(None, description="Дата загрузки до (YYYY-MM-DD)"),
        sort_by: str = Query("created_at", description="Поле сортировки: created_at, original_name, detected_count"),
        sort_order: str = Query("desc", description="Направление: asc / desc"),
        page: int = Query(1, ge=1, description="Номер страницы (с 1)"),
        limit: int = Query(10, ge=1, le=100, description="Записей на странице (макс. 100)"),
        current_user: UserResponse = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    """
    Список изображений с фильтрацией, поиском, сортировкой и пагинацией.

    - **search**: подстрока в оригинальном имени файла
    - **processed**: true — только обработанные, false — только необработанные
    - **date_from / date_to**: диапазон дат загрузки
    - **sort_by**: поле сортировки
    - **sort_order**: asc или desc
    - **page / limit**: пагинация
    """
    valid_sort_fields = {"created_at", "original_name", "detected_count"}
    if sort_by not in valid_sort_fields:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"sort_by должен быть одним из: {', '.join(valid_sort_fields)}",
        )
    if sort_order not in ("asc", "desc"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="sort_order должен быть 'asc' или 'desc'",
        )
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from не может быть позже date_to",
        )

    return ImageService.get_user_images(
        current_user=current_user,
        db=db,
        search=search,
        processed=processed,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit,
    )


@router.get("/{image_id}/presigned-url")
async def get_presigned_url(
        image_id: int,
        current_user: UserResponse = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    """Возвращает временный pre-signed URL для скачивания файла из S3."""
    from models.image import Image

    query = db.query(Image).filter(Image.id == image_id)
    if current_user.role != "admin":
        query = query.filter(Image.user_id == current_user.id)

    image = query.first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Изображение не найдено")

    if not image.s3_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл хранится локально, pre-signed URL недоступен",
        )

    try:
        url = StorageService.get_presigned_url(image.s3_key)
        return {"url": url, "expires_in": 3600}
    except Exception as e:
        logger.error(f"Ошибка генерации pre-signed URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сгенерировать ссылку для скачивания",
        )


@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(
        image_id: int,
        current_user: UserResponse = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    """Получение конкретного изображения по ID."""
    from models.image import Image

    query = db.query(Image).filter(Image.id == image_id)
    if current_user.role != "admin":
        query = query.filter(Image.user_id == current_user.id)

    image = query.first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Изображение не найдено")

    from services.image_service import _build_image_response
    return _build_image_response(image)


@router.delete("/{image_id}")
async def delete_image(
        image_id: int,
        current_user: UserResponse = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    """Удаление изображения (admin — любое, user — только своё)."""
    return ImageService.delete_image(image_id, current_user, db)
