import json
import logging
import math
import os
import shutil
import uuid
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Session

from core import UPLOADS_DIR
from models.image import Image as ImageModel
from models.user import User
from schemas.image import ImageResponse, PaginatedImageResponse
from .ai_service import ai_service
from .storage_service import StorageService

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif",
    "image/webp", "image/bmp", "image/tiff"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 МБ


def _build_image_response(img: ImageModel) -> dict:
    """Строит словарь ответа для одного изображения, генерируя URL."""
    detected_objects = []
    if img.detected_objects:
        try:
            detected_objects = json.loads(img.detected_objects)
        except Exception:
            detected_objects = []

    if img.s3_key:
        try:
            url = StorageService.get_presigned_url(img.s3_key)
        except Exception as e:
            logger.warning(f"Не удалось получить pre-signed URL для {img.s3_key}: {e}")
            url = f"/uploads/{img.filename}"
    else:
        url = f"/uploads/{img.filename}"

    return {
        "id": img.id,
        "filename": img.filename,
        "original_name": img.original_name,
        "created_at": img.created_at.isoformat(),
        "url": url,
        "processed": getattr(img, "processed", False),
        "detected_objects": detected_objects,
        "detected_count": getattr(img, "detected_count", len(detected_objects)),
        "s3_key": img.s3_key,
    }


class ImageService:

    @staticmethod
    def upload_image(
            file: UploadFile,
            current_user,
            db: Session,
            process_type: str = "blur"
    ) -> dict:
        """Загрузка и обработка изображения с AI, затем сохранение в S3."""

        # Валидация типа файла
        content_type = file.content_type or ""
        if content_type not in ALLOWED_CONTENT_TYPES and not content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Допустимы только изображения. Получен тип: {content_type}"
            )

        # Валидация размера
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Размер файла превышает {MAX_FILE_SIZE // 1024 // 1024} МБ"
            )

        # Проверка лимита для free_user
        if current_user.role == "free_user" and current_user.upload_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Лимит загрузок исчерпан. Перейдите на Pro."
            )

        # Генерация уникального имени файла
        file_extension = Path(file.filename or "image").suffix.lower() or ".jpg"
        unique_id = str(uuid.uuid4())
        original_filename = f"{unique_id}{file_extension}"
        original_path = UPLOADS_DIR / original_filename

        # Сохраняем оригинал локально для AI обработки
        with open(original_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # AI обработка
        processed_filename = original_filename
        detected_objects = []
        is_processed = False

        if process_type != "none":
            try:
                logger.info(f"Начинаю AI обработку: {original_path}")
                processed_path_str, detected_objects = ai_service.process_image(
                    image_path=str(original_path),
                    method=process_type
                )
                processed_path = Path(processed_path_str)
                if processed_path.exists() and processed_path_str != str(original_path):
                    processed_filename = processed_path.name
                    is_processed = True
                    logger.info(f"AI обработка завершена: {len(detected_objects)} объектов")
                else:
                    logger.warning("AI не применил изменения, используем оригинал")
            except Exception as e:
                logger.error(f"Ошибка AI обработки: {e}")
                detected_objects = []

        detected_count = len(detected_objects)
        detected_objects_json = json.dumps(detected_objects, ensure_ascii=False) if detected_objects else None

        # Загружаем обработанный файл в S3
        s3_key = None
        processed_local_path = UPLOADS_DIR / processed_filename
        try:
            s3_key = f"{current_user.id}/{processed_filename}"
            StorageService.upload_file(
                local_path=str(processed_local_path),
                s3_key=s3_key,
                content_type=content_type if content_type.startswith("image/") else "image/jpeg",
            )
            logger.info(f"Файл загружен в S3: {s3_key}")
        except Exception as e:
            logger.warning(f"Не удалось загрузить в S3 (будет использован локальный файл): {e}")
            s3_key = None

        # Сохраняем запись в БД
        db_image = ImageModel(
            filename=processed_filename,
            original_name=file.filename,
            user_id=current_user.id,
            processed=is_processed,
            detected_objects=detected_objects_json,
            detected_count=detected_count,
            s3_key=s3_key,
        )
        db.add(db_image)
        db.commit()
        db.refresh(db_image)

        # Увеличиваем счётчик загрузок для free_user
        if current_user.role == "free_user":
            db_user = db.query(User).filter(User.id == current_user.id).first()
            if db_user:
                db_user.upload_count += 1
                db.commit()

        return _build_image_response(db_image)

    @staticmethod
    def get_user_images(
            current_user,
            db: Session,
            search: Optional[str] = None,
            processed: Optional[bool] = None,
            date_from: Optional[date] = None,
            date_to: Optional[date] = None,
            sort_by: str = "created_at",
            sort_order: str = "desc",
            page: int = 1,
            limit: int = 10,
    ) -> PaginatedImageResponse:
        """Возвращает изображения с фильтрацией, сортировкой и пагинацией."""

        query = db.query(ImageModel)

        # Ограничение по роли
        if getattr(current_user, "role", "user") != "admin":
            query = query.filter(ImageModel.user_id == current_user.id)

        # Фильтр: поиск по имени файла
        if search and search.strip():
            query = query.filter(
                ImageModel.original_name.ilike(f"%{search.strip()}%")
            )

        # Фильтр: статус обработки
        if processed is not None:
            query = query.filter(ImageModel.processed == processed)

        # Фильтр: дата загрузки (от)
        if date_from:
            query = query.filter(func.date(ImageModel.created_at) >= date_from)

        # Фильтр: дата загрузки (до)
        if date_to:
            query = query.filter(func.date(ImageModel.created_at) <= date_to)

        # Подсчёт общего числа записей
        total = query.count()

        # Сортировка
        sort_column_map = {
            "created_at": ImageModel.created_at,
            "original_name": ImageModel.original_name,
            "detected_count": ImageModel.detected_count,
        }
        sort_col = sort_column_map.get(sort_by, ImageModel.created_at)
        if sort_order == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

        # Пагинация
        limit = max(1, min(limit, 100))
        page = max(1, page)
        offset = (page - 1) * limit
        images = query.offset(offset).limit(limit).all()

        pages = math.ceil(total / limit) if total > 0 else 1

        items = [_build_image_response(img) for img in images]

        return PaginatedImageResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    @staticmethod
    def delete_image(image_id: int, current_user, db: Session) -> dict:
        """Удаление изображения (admin — любое, user — только своё)."""
        query = db.query(ImageModel).filter(ImageModel.id == image_id)
        if getattr(current_user, "role", "user") != "admin":
            query = query.filter(ImageModel.user_id == current_user.id)

        image = query.first()
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Изображение не найдено"
            )

        # Удаляем из S3
        if image.s3_key:
            try:
                StorageService.delete_file(image.s3_key)
            except Exception as e:
                logger.error(f"Ошибка удаления из S3: {e}")

        # Удаляем локальные файлы
        try:
            file_path = UPLOADS_DIR / image.filename
            if file_path.exists():
                file_path.unlink()
            if image.filename.startswith("processed_"):
                original_name = image.filename.replace("processed_", "", 1)
                original_path = UPLOADS_DIR / original_name
                if original_path.exists():
                    original_path.unlink()
        except Exception as e:
            logger.error(f"Ошибка удаления локального файла: {e}")

        db.delete(image)
        db.commit()

        return {"message": "Изображение успешно удалено"}
