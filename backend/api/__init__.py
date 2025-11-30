# backend/api/__init__.py
from fastapi import APIRouter
from .auth import router as auth_router
from .image import router as image_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(image_router, prefix="/image", tags=["image"])