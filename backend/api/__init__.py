from fastapi import APIRouter
from .auth import router as auth_router
from .image import router as image_router
from .admin import router as admin_router
from .geo import router as geo_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(image_router, prefix="/image", tags=["image"])
router.include_router(admin_router, prefix="/admin", tags=["admin"])
# Геолокация (сторонний API): /geo/location
router.include_router(geo_router, prefix="/geo", tags=["geo"])