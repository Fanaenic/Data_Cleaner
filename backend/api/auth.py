from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core import get_db
from services import AuthService
from schemas.user import UserCreate, UserLogin, TokenResponse, RefreshTokenRequest
from dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        user = AuthService.create_user(db, user_data)
        access_token = AuthService.create_access_token(data={"sub": user.email})
        refresh_token = AuthService.create_refresh_token(db, user.id, user.email)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=user
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = AuthService.authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = AuthService.create_access_token(data={"sub": user.email})
    refresh_token = AuthService.create_refresh_token(db, user.id, user.email)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Обновить пару токенов (ротация refresh token)."""
    user, old_jti = AuthService.validate_refresh_token(db, data.refresh_token)

    # Отозвать старый refresh token
    AuthService.revoke_refresh_token(db, old_jti)

    # Выпустить новую пару
    new_access_token = AuthService.create_access_token(data={"sub": user.email})
    new_refresh_token = AuthService.create_refresh_token(db, user.id, user.email)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=user
    )


@router.post("/logout")
async def logout(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Выход — отзыв refresh token. Access token станет недействительным по истечении TTL."""
    try:
        _, jti = AuthService.validate_refresh_token(db, data.refresh_token)
        AuthService.revoke_refresh_token(db, jti)
    except HTTPException:
        pass  # Токен уже невалиден — выход всё равно считается успешным
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    """Получить данные текущего пользователя."""
    return current_user
