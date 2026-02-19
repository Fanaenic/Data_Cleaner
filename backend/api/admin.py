from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from core import get_db
from models.user import User
from schemas.user import UserAdminView, UserRoleUpdate
from dependencies import require_role

router = APIRouter()

ALLOWED_ROLES = {'free_user', 'pro_user', 'admin'}

require_admin = require_role(['admin'])


@router.get("/users", response_model=List[UserAdminView])
async def list_users(
        db: Session = Depends(get_db),
        current_user=Depends(require_admin)
):
    """Список всех пользователей (только admin)."""
    users = db.query(User).order_by(User.id).all()
    return [
        UserAdminView(
            id=u.id,
            email=u.email,
            username=u.username,
            name=u.name,
            role=u.role,
            created_at=u.created_at.isoformat()
        )
        for u in users
    ]


@router.put("/users/{user_id}/role", response_model=UserAdminView)
async def update_user_role(
        user_id: int,
        role_data: UserRoleUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin)
):
    """Изменить роль пользователя (только admin)."""
    if role_data.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Allowed: {', '.join(ALLOWED_ROLES)}"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.role = role_data.role
    db.commit()
    db.refresh(user)

    return UserAdminView(
        id=user.id,
        email=user.email,
        username=user.username,
        name=user.name,
        role=user.role,
        created_at=user.created_at.isoformat()
    )
