# backend/main.py
import os
from datetime import datetime, timedelta
from typing import Dict
from datetime import timezone
import jwt
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import uuid
from models import Image as ImageModel
from auth import (
    UserCreate,
    create_user,
    authenticate_user,
    get_current_user,
    UserResponse
)
from database import get_db
from models import Image as ImageModel, Base  # ← добавили Base
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

from database import engine
Base.metadata.create_all(bind=engine)


app = FastAPI(title="DataCleaner API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/register", response_model=Dict, status_code=status.HTTP_201_CREATED)
async def register(user_data: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user_create = UserCreate(
            email=user_data.email,
            username=user_data.email,
            name=user_data.name,
            password=user_data.password
        )

        user = create_user(db, user_create)

        access_token = create_access_token(data={"sub": user.email})

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@app.post("/login", response_model=Dict)
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    }


@app.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_image(
        file: UploadFile = File(...),
        current_user: UserResponse = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    print("=== UPLOAD CALLED ===")
    print("Current user:", current_user)
    print("File:", file.filename, file.content_type)

    try:
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image files are allowed"
            )

        file_extension = Path(file.filename).suffix
        if not file_extension:
            file_extension = ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOADS_DIR / unique_filename  # ← ИСПОЛЬЗУЕМ АБСОЛЮТНЫЙ ПУТЬ

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

        return {
            "message": "Image uploaded successfully",
            "image_id": db_image.id,
            "filename": db_image.filename,
            "original_name": db_image.original_name
        }
    except Exception as e:
        print("ERROR in /upload:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/images")
async def get_user_images(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    images = db.query(ImageModel).filter(ImageModel.user_id == current_user.id).all()
    return [
        {
            "id": img.id,
            "filename": img.filename,
            "original_name": img.original_name,
            "created_at": img.created_at.isoformat()
        }
        for img in images
    ]
from fastapi.staticfiles import StaticFiles

# Раздаём папку uploads как статические файлы
BASE_DIR = Path(__file__).parent.parent  # выходим из backend/ на уровень выше
UPLOADS_DIR = BASE_DIR / "uploads"

# Убедимся, что папка существует
UPLOADS_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app=app,
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )