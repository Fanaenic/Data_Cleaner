from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from jwt.exceptions import InvalidTokenError
import jwt

from core import SECRET_KEY, ALGORITHM, oauth2_scheme, get_db
from models.user import User
from schemas.user import UserResponse


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserResponse:
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
        role=user.role,
        upload_count=user.upload_count,
        created_at=user.created_at.isoformat()
    )


def require_role(roles: List[str]):
    """
    Фабрика dependency-зависимостей для проверки ролей.
    Принимает список допустимых ролей. Возвращает 403 при недостатке прав.

    Пример: require_role(["admin", "pro_user"])
    """
    def check_role(current_user: UserResponse = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return check_role
