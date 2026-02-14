from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.favorite import Favorite
from app.models.rig import Rig

router = APIRouter(prefix="/favorites", tags=["Favorites"])


@router.get("")
async def list_favorites(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Favorite)
        .options(selectinload(Favorite.rig).selectinload(Rig.algorithm))
        .where(Favorite.user_id == user.id)
        .order_by(Favorite.created_at.desc())
    )
    favs = result.scalars().all()
    return [{"rig_id": f.rig_id, "created_at": f.created_at} for f in favs]


@router.post("/{rig_id}")
async def add_favorite(
    rig_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rig = await db.get(Rig, rig_id)
    if not rig:
        raise HTTPException(status_code=404, detail="The requested rig could not be found.")

    fav = Favorite(user_id=user.id, rig_id=rig_id)
    db.add(fav)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="This rig is already in your favorites.")
    return {"message": "Added to favorites"}


@router.delete("/{rig_id}")
async def remove_favorite(
    rig_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Favorite).where(Favorite.user_id == user.id, Favorite.rig_id == rig_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="This rig is not in your favorites.")
    return {"message": "Removed from favorites"}
