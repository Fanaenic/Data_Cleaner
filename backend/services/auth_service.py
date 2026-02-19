from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from jwt.exceptions import InvalidTokenError
import jwt
from datetime import datetime, timedelta
from core import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from models.user import User
from schemas.user import UserCreate, UserResponse

ph = PasswordHasher()

class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return ph.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        try:
            return ph.verify(hashed_password, plain_password)
        except VerifyMismatchError:
            return False

    @staticmethod
    def create_user(db: Session, user: UserCreate):
        existing_user = db.query(User).filter(
            (User.email == user.email) | (User.username == user.username)
        ).first()

        if existing_user:
            if existing_user.email == user.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )

        # Bootstrap: первый пользователь без роли admin становится admin
        admin_exists = db.query(User).filter(User.role == 'admin').first()
        role = 'free_user' if admin_exists else 'admin'

        hashed_password = AuthService.hash_password(user.password)
        db_user = User(
            email=user.email,
            username=user.username,
            name=user.name,
            hashed_password=hashed_password,
            role=role
        )

        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        return UserResponse(
            id=db_user.id,
            email=db_user.email,
            username=db_user.username,
            name=db_user.name,
            role=db_user.role,
            upload_count=db_user.upload_count,
            created_at=db_user.created_at.isoformat()
        )

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str):
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not AuthService.verify_password(password, user.hashed_password):
            return None

        return UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            name=user.name,
            role=user.role,
            upload_count=user.upload_count,
            created_at=user.created_at.isoformat()
        )

    @staticmethod
    def create_access_token(data: dict):
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
