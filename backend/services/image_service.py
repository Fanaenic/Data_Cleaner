from fastapi import HTTPException, status, UploadFile
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import uuid
import os
import logging
import json

from core import UPLOADS_DIR
from models.image import Image as ImageModel
from models.user import User
from schemas.image import ImageResponse
from .ai_service import ai_service

logger = logging.getLogger(__name__)


class ImageService:
    @staticmethod
    def upload_image(
            file: UploadFile,
            current_user,
            db: Session,
            process_type: str = "blur"
    ):
        """
        Загрузка и обработка изображения с AI
        """
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image files are allowed"
            )

        # Проверка размера файла
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

        MAX_SIZE = 10 * 1024 * 1024
        if file_size > MAX_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds {MAX_SIZE // 1024 // 1024}MB limit"
            )

        # Проверка лимита загрузок для free_user
        if current_user.role == 'free_user' and current_user.upload_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Upload limit reached. Upgrade to Pro."
            )

        # Генерация уникального имени
        file_extension = Path(file.filename).suffix.lower()
        if not file_extension:
            file_extension = ".jpg"

        original_filename = f"{uuid.uuid4()}{file_extension}"
        original_path = UPLOADS_DIR / original_filename

        # Сохраняем оригинальный файл
        with open(original_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Обрабатываем изображение если нужно
        processed_filename = None
        detected_objects = []
        is_processed = False

        if process_type != "none":
            try:
                logger.info(f"🔧 Начинаю AI обработку: {original_path}")

                processed_path_str, detected_objects = ai_service.process_image(
                    image_path=str(original_path),
                    method=process_type
                )

                processed_path = Path(processed_path_str)

                if processed_path.exists() and processed_path_str != str(original_path):
                    processed_filename = processed_path.name
                    is_processed = True
                    logger.info(f"✅ AI обработка завершена: {len(detected_objects)} объектов")
                else:
                    logger.warning("⚠️ AI не применил изменения, используем оригинал")
                    processed_filename = original_filename

            except Exception as e:
                logger.error(f"❌ Ошибка AI обработки: {e}")
                processed_filename = original_filename
                detected_objects = []
        else:
            processed_filename = original_filename

        # Конвертируем объекты для JSON
        detected_objects_json = json.dumps(detected_objects, ensure_ascii=False) if detected_objects else None

        # Сохраняем в БД
        db_image = ImageModel(
            filename=processed_filename,
            original_name=file.filename,
            user_id=current_user.id,
            processed=is_processed,
            detected_objects=detected_objects_json
        )

        db.add(db_image)
        db.commit()
        db.refresh(db_image)

        # Увеличиваем счётчик загрузок для free_user
        if current_user.role == 'free_user':
            db_user = db.query(User).filter(User.id == current_user.id).first()
            if db_user:
                db_user.upload_count += 1
                db.commit()

        # Формируем URL
        image_url = f"/uploads/{processed_filename}"

        return {
            "id": db_image.id,
            "filename": processed_filename,
            "original_name": db_image.original_name,
            "created_at": db_image.created_at.isoformat(),
            "url": image_url,
            "processed": is_processed,
            "detected_objects": detected_objects,
            "detected_count": len(detected_objects)
        }

    @staticmethod
    def get_user_images(current_user, db: Session):
        # admin видит все изображения, user только свои
        if getattr(current_user, 'role', 'user') == 'admin':
            images = db.query(ImageModel).order_by(ImageModel.id.desc()).all()
        else:
            images = db.query(ImageModel).filter(ImageModel.user_id == current_user.id).all()

        result = []
        for img in images:
            detected_objects = []
            if img.detected_objects:
                try:
                    detected_objects = json.loads(img.detected_objects)
                except:
                    detected_objects = []

            image_data = {
                "id": img.id,
                "filename": img.filename,
                "original_name": img.original_name,
                "created_at": img.created_at.isoformat(),
                "url": f"/uploads/{img.filename}",
                "processed": getattr(img, 'processed', False),
                "detected_objects": detected_objects,
                "detected_count": len(detected_objects)
            }
            result.append(image_data)

        return result

    @staticmethod
    def delete_image(image_id: int, current_user, db: Session):
        """Удаление изображения. admin может удалить любое, user только своё."""
        query = db.query(ImageModel).filter(ImageModel.id == image_id)
        if getattr(current_user, 'role', 'user') != 'admin':
            query = query.filter(ImageModel.user_id == current_user.id)

        image = query.first()

        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )

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
            logger.error(f"Error deleting file: {e}")

        db.delete(image)
        db.commit()

        return {"message": "Image deleted successfully"}