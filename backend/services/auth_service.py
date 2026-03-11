import uuid
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from jwt.exceptions import InvalidTokenError
import jwt
from datetime import datetime, timedelta

from core import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from schemas.user import UserCreate, UserResponse
from repositories.user_repository import UserRepository
from repositories.token_repository import TokenRepository

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
    def create_user(db: Session, user: UserCreate) -> UserResponse:
        user_repo = UserRepository(db)
        existing_user = user_repo.get_by_email_or_username(user.email, user.username)

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

        admin_exists = user_repo.get_admin()
        role = 'free_user' if admin_exists else 'admin'

        hashed_password = AuthService.hash_password(user.password)
        db_user = user_repo.create(
            email=user.email,
            username=user.username,
            name=user.name,
            hashed_password=hashed_password,
            role=role
        )

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
        user_repo = UserRepository(db)
        user = user_repo.get_by_email(email)
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
    def create_access_token(data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def create_refresh_token(db: Session, user_id: int, user_email: str) -> str:
        jti = str(uuid.uuid4())
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

        token_repo = TokenRepository(db)
        token_repo.create(jti=jti, user_id=user_id, expires_at=expire)

        payload = {"sub": user_email, "jti": jti, "type": "refresh", "exp": expire}
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def validate_refresh_token(db: Session, token: str):
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("type") != "refresh":
                raise credentials_exception
            email: str = payload.get("sub")
            jti: str = payload.get("jti")
            if not email or not jti:
                raise credentials_exception
        except InvalidTokenError:
            raise credentials_exception

        token_repo = TokenRepository(db)
        db_token = token_repo.get_by_jti(jti)
        if not db_token or db_token.revoked:
            raise credentials_exception

        user_repo = UserRepository(db)
        user = user_repo.get_by_email(email)
        if not user:
            raise credentials_exception

        user_response = UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            name=user.name,
            role=user.role,
            upload_count=user.upload_count,
            created_at=user.created_at.isoformat()
        )
        return user_response, jti

    @staticmethod
    def revoke_refresh_token(db: Session, jti: str) -> None:
        TokenRepository(db).revoke(jti)

    @staticmethod
    def revoke_all_refresh_tokens(db: Session, user_id: int) -> None:
        TokenRepository(db).revoke_all_for_user(user_id)
