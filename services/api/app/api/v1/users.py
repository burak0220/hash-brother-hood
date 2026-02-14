from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, cast, Date

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.user import UserResponse, UserUpdate, PasswordChange
from app.schemas.common import MessageResponse
from app.services.user import update_user_profile, change_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await update_user_profile(db, user, **data.model_dump(exclude_unset=True))
    return updated


@router.post("/me/password", response_model=MessageResponse)
async def update_password(
    data: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await change_password(db, user, data.current_password, data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="The current password you entered is incorrect. Please try again.")
    return {"message": "Password updated successfully"}


@router.get("/me/earnings")
async def get_earnings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get daily earnings for the last 7 days."""
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    result = await db.execute(
        select(
            cast(Transaction.created_at, Date).label("date"),
            func.coalesce(func.sum(Transaction.amount), 0).label("earnings"),
        )
        .where(
            Transaction.user_id == user.id,
            Transaction.type == "rental_earning",
            Transaction.status == "completed",
            Transaction.created_at >= seven_days_ago,
        )
        .group_by(cast(Transaction.created_at, Date))
        .order_by(cast(Transaction.created_at, Date))
    )
    rows = result.all()

    # Build 7-day array with zero fills
    data = []
    for i in range(7):
        day = (now - timedelta(days=6 - i)).date()
        earned = next((float(r.earnings) for r in rows if r.date == day), 0.0)
        data.append({"date": day.strftime("%a"), "earnings": earned})

    return data
