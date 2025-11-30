# backend/api/image.py
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from backend.core import get_db, oauth2_scheme
from backend.services import AuthService, ImageService
from backend.schemas.image import ImageResponse

router = APIRouter()

@router.post("/", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    current_user = AuthService.get_current_user(token, db)
    return ImageService.upload_image(file, current_user, db)

@router.get("/", response_model=list[ImageResponse])
async def get_user_images(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    current_user = AuthService.get_current_user(token, db)
    return ImageService.get_user_images(current_user, db)