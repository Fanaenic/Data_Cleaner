from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import uuid
from core import UPLOADS_DIR  # Измените с backend.core
from models.image import Image as ImageModel  # Измените с backend.models
from schemas.image import ImageResponse  # Измените с backend.schemas

class ImageService:
    @staticmethod
    def upload_image(file, current_user, db: Session):
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image files are allowed"
            )

        file_extension = Path(file.filename).suffix
        if not file_extension:
            file_extension = ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOADS_DIR / unique_filename

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        db_image = ImageModel(
            filename=unique_filename,
            original_name=file.filename,
            user_id=current_user.id
        )
        db.add(db_image)
        db.commit()
        db.refresh(db_image)

        return ImageResponse(
            id=db_image.id,
            filename=db_image.filename,
            original_name=db_image.original_name,
            created_at=db_image.created_at.isoformat()
        )

    @staticmethod
    def get_user_images(current_user, db: Session):
        images = db.query(ImageModel).filter(ImageModel.user_id == current_user.id).all()
        return [
            ImageResponse(
                id=img.id,
                filename=img.filename,
                original_name=img.original_name,
                created_at=img.created_at.isoformat()
            )
            for img in images
        ]