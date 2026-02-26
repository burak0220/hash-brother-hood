from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, cast, Date

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.models.pool_profile import PoolProfile
from app.schemas.user import UserResponse, UserUpdate, PasswordChange
from app.schemas.pool_profile import PoolProfileCreate, PoolProfileUpdate, PoolProfileResponse
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

    data = []
    for i in range(7):
        day = (now - timedelta(days=6 - i)).date()
        earned = next((float(r.earnings) for r in rows if r.date == day), 0.0)
        data.append({"date": day.strftime("%a"), "earnings": earned})

    return data


# ─── Pool Profiles ────────────────────────────────────────────────────────────

@router.get("/me/pool-profiles", response_model=list[PoolProfileResponse])
async def list_pool_profiles(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saved pool profiles for the current user."""
    from sqlalchemy.orm import selectinload as sload
    result = await db.execute(
        select(PoolProfile)
        .options(sload(PoolProfile.algorithm))
        .where(PoolProfile.user_id == user.id)
        .order_by(PoolProfile.is_default.desc(), PoolProfile.created_at.asc())
    )
    profiles = result.scalars().all()
    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "name": p.name,
            "algorithm_id": p.algorithm_id,
            "algorithm_name": p.algorithm.display_name if p.algorithm else None,
            "pool_url": p.pool_url,
            "pool_user": p.pool_user,
            "pool_password": p.pool_password,
            "pool2_url": p.pool2_url,
            "pool2_user": p.pool2_user,
            "pool2_password": p.pool2_password,
            "pool3_url": p.pool3_url,
            "pool3_user": p.pool3_user,
            "pool3_password": p.pool3_password,
            "pool4_url": p.pool4_url,
            "pool4_user": p.pool4_user,
            "pool4_password": p.pool4_password,
            "pool5_url": p.pool5_url,
            "pool5_user": p.pool5_user,
            "pool5_password": p.pool5_password,
            "is_default": p.is_default,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        for p in profiles
    ]


@router.post("/me/pool-profiles", response_model=PoolProfileResponse, status_code=201)
async def create_pool_profile(
    data: PoolProfileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new saved pool profile."""
    # Limit to 20 profiles per user
    count_result = await db.execute(
        select(func.count()).where(PoolProfile.user_id == user.id)
    )
    count = count_result.scalar() or 0
    if count >= 20:
        raise HTTPException(status_code=400, detail="You have reached the maximum of 20 saved pool profiles.")

    # If this is marked as default, unset other defaults
    if data.is_default:
        result = await db.execute(
            select(PoolProfile).where(PoolProfile.user_id == user.id, PoolProfile.is_default == True)
        )
        for p in result.scalars().all():
            p.is_default = False

    profile = PoolProfile(
        user_id=user.id,
        name=data.name,
        algorithm_id=data.algorithm_id,
        pool_url=data.pool_url,
        pool_user=data.pool_user,
        pool_password=data.pool_password,
        pool2_url=data.pool2_url,
        pool2_user=data.pool2_user,
        pool2_password=data.pool2_password,
        pool3_url=data.pool3_url,
        pool3_user=data.pool3_user,
        pool3_password=data.pool3_password,
        pool4_url=data.pool4_url,
        pool4_user=data.pool4_user,
        pool4_password=data.pool4_password,
        pool5_url=data.pool5_url,
        pool5_user=data.pool5_user,
        pool5_password=data.pool5_password,
        is_default=data.is_default,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)

    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "name": profile.name,
        "algorithm_id": profile.algorithm_id,
        "algorithm_name": None,
        "pool_url": profile.pool_url,
        "pool_user": profile.pool_user,
        "pool_password": profile.pool_password,
        "pool2_url": profile.pool2_url,
        "pool2_user": profile.pool2_user,
        "pool2_password": profile.pool2_password,
        "pool3_url": profile.pool3_url,
        "pool3_user": profile.pool3_user,
        "pool3_password": profile.pool3_password,
        "pool4_url": profile.pool4_url,
        "pool4_user": profile.pool4_user,
        "pool4_password": profile.pool4_password,
        "pool5_url": profile.pool5_url,
        "pool5_user": profile.pool5_user,
        "pool5_password": profile.pool5_password,
        "is_default": profile.is_default,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


@router.put("/me/pool-profiles/{profile_id}", response_model=PoolProfileResponse)
async def update_pool_profile(
    profile_id: int,
    data: PoolProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a saved pool profile."""
    from sqlalchemy.orm import selectinload as sload
    result = await db.execute(
        select(PoolProfile)
        .options(sload(PoolProfile.algorithm))
        .where(PoolProfile.id == profile_id, PoolProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Pool profile not found.")

    if data.name is not None:
        profile.name = data.name
    if data.algorithm_id is not None:
        profile.algorithm_id = data.algorithm_id
    if data.pool_url is not None:
        profile.pool_url = data.pool_url
    if data.pool_user is not None:
        profile.pool_user = data.pool_user
    if data.pool_password is not None:
        profile.pool_password = data.pool_password
    # Backup pools — allow setting to None to clear
    for field in ['pool2_url', 'pool2_user', 'pool2_password',
                  'pool3_url', 'pool3_user', 'pool3_password',
                  'pool4_url', 'pool4_user', 'pool4_password',
                  'pool5_url', 'pool5_user', 'pool5_password']:
        val = getattr(data, field, None)
        if val is not None:
            setattr(profile, field, val if val != "" else None)
    if data.is_default is not None:
        if data.is_default:
            # Unset other defaults
            others = await db.execute(
                select(PoolProfile).where(PoolProfile.user_id == user.id, PoolProfile.is_default == True)
            )
            for p in others.scalars().all():
                p.is_default = False
        profile.is_default = data.is_default

    await db.flush()
    await db.refresh(profile)

    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "name": profile.name,
        "algorithm_id": profile.algorithm_id,
        "algorithm_name": profile.algorithm.display_name if profile.algorithm else None,
        "pool_url": profile.pool_url,
        "pool_user": profile.pool_user,
        "pool_password": profile.pool_password,
        "pool2_url": profile.pool2_url,
        "pool2_user": profile.pool2_user,
        "pool2_password": profile.pool2_password,
        "pool3_url": profile.pool3_url,
        "pool3_user": profile.pool3_user,
        "pool3_password": profile.pool3_password,
        "pool4_url": profile.pool4_url,
        "pool4_user": profile.pool4_user,
        "pool4_password": profile.pool4_password,
        "pool5_url": profile.pool5_url,
        "pool5_user": profile.pool5_user,
        "pool5_password": profile.pool5_password,
        "is_default": profile.is_default,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


@router.delete("/me/pool-profiles/{profile_id}")
async def delete_pool_profile(
    profile_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved pool profile."""
    result = await db.execute(
        select(PoolProfile).where(PoolProfile.id == profile_id, PoolProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Pool profile not found.")

    await db.delete(profile)
    return {"message": "Pool profile deleted successfully."}
