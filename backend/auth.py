# backend/auth.py
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from pydantic import BaseModel
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jwt.exceptions import InvalidTokenError
import jwt

from database import get_db, engine
from models import User
from config import SECRET_KEY, ALGORITHM

ph = PasswordHasher()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


class UserCreate(BaseModel):
    email: str
    username: str
    name: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    name: str
    created_at: str


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False


def create_user(db, user: UserCreate):
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

    hashed_password = hash_password(user.password)
    db_user = User(
        email=user.email,
        username=user.username,
        name=user.name,
        hashed_password=hashed_password
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return UserResponse(
        id=db_user.id,
        email=db_user.email,
        username=db_user.username,
        name=db_user.name,
        created_at=db_user.created_at.isoformat()
    )


def authenticate_user(db, username: str, password: str):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None

    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        name=user.name,
        created_at=user.created_at.isoformat()
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> UserResponse:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        name=user.name,
        created_at=user.created_at.isoformat()
    )