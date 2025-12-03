from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query
from sqlalchemy.orm import Session
import logging

from core import get_db, oauth2_scheme
from services import AuthService, ImageService
from schemas.image import ImageResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
        file: UploadFile = File(...),
        process_type: str = Query("blur", description="Тип обработки: blur, pixelate, none"),
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db)
):
    """
    Загрузка изображения с AI обработкой
    """
    try:
        current_user = AuthService.get_current_user(token, db)

        logger.info(f"Загрузка изображения от пользователя {current_user.email}")
        logger.info(f"Тип обработки: {process_type}")

        result = ImageService.upload_image(
            file=file,
            current_user=current_user,
            db=db,
            process_type=process_type
        )

        return result

    except Exception as e:
        logger.error(f"Ошибка загрузки изображения: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки изображения: {str(e)}"
        )


@router.get("/", response_model=list[ImageResponse])
async def get_user_images(
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db)
):
    """Получение всех изображений пользователя"""
    current_user = AuthService.get_current_user(token, db)
    return ImageService.get_user_images(current_user, db)


@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(
        image_id: int,
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db)
):
    """Получение конкретного изображения"""
    current_user = AuthService.get_current_user(token, db)

    from models.image import Image

    image = db.query(Image).filter(
        Image.id == image_id,
        Image.user_id == current_user.id
    ).first()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    import json

    detected_objects = []
    if hasattr(image, 'detected_objects') and image.detected_objects:
        try:
            detected_objects = json.loads(image.detected_objects)
        except:
            detected_objects = []

    return {
        "id": image.id,
        "filename": image.filename,
        "original_name": image.original_name,
        "created_at": image.created_at.isoformat(),
        "url": f"/uploads/{image.filename}",
        "processed": getattr(image, 'processed', False),
        "detected_objects": detected_objects,
        "detected_count": len(detected_objects)
    }


@router.delete("/{image_id}")
async def delete_image(
        image_id: int,
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db)
):
    """Удаление изображения"""
    current_user = AuthService.get_current_user(token, db)
    return ImageService.delete_image(image_id, current_user, db)