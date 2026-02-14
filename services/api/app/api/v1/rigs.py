import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.rig import RigCreate, RigUpdate, RigResponse, RigListResponse
from app.services.rig import create_rig, get_rig, update_rig, delete_rig, list_marketplace_rigs, list_user_rigs

router = APIRouter(prefix="/rigs", tags=["Rigs"])


def _rig_to_response(rig) -> dict:
    data = {
        "id": rig.id,
        "owner_id": rig.owner_id,
        "name": rig.name,
        "description": rig.description,
        "algorithm_id": rig.algorithm_id,
        "hashrate": rig.hashrate,
        "price_per_hour": rig.price_per_hour,
        "min_rental_hours": rig.min_rental_hours,
        "max_rental_hours": rig.max_rental_hours,
        "status": rig.status,
        "region": rig.region,
        "uptime_percentage": rig.uptime_percentage,
        "total_rentals": rig.total_rentals,
        "average_rating": rig.average_rating,
        "stratum_host": rig.stratum_host,
        "stratum_port": rig.stratum_port,
        "worker_prefix": rig.worker_prefix,
        "is_featured": rig.is_featured,
        "created_at": rig.created_at,
        "updated_at": rig.updated_at,
    }
    if hasattr(rig, "algorithm") and rig.algorithm:
        data["algorithm"] = {
            "id": rig.algorithm.id,
            "name": rig.algorithm.name,
            "display_name": rig.algorithm.display_name,
            "unit": rig.algorithm.unit,
            "description": rig.algorithm.description,
            "is_active": rig.algorithm.is_active,
        }
    if hasattr(rig, "owner") and rig.owner:
        data["owner"] = {
            "id": rig.owner.id,
            "username": rig.owner.username,
            "avatar_url": rig.owner.avatar_url,
            "bio": rig.owner.bio,
            "created_at": rig.owner.created_at,
        }
    return data


@router.get("/marketplace", response_model=RigListResponse)
async def marketplace(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    algorithm_id: int | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    search: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    db: AsyncSession = Depends(get_db),
):
    rigs, total = await list_marketplace_rigs(
        db, page=page, per_page=per_page, algorithm_id=algorithm_id,
        sort_by=sort_by, sort_order=sort_order, search=search,
        min_price=min_price, max_price=max_price,
    )
    return {
        "items": [_rig_to_response(r) for r in rigs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.get("/my-rigs", response_model=list[RigResponse])
async def my_rigs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rigs = await list_user_rigs(db, user.id)
    return [_rig_to_response(r) for r in rigs]


@router.post("", response_model=RigResponse, status_code=201)
async def create(
    data: RigCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rig = await create_rig(db, user.id, **data.model_dump())
    full_rig = await get_rig(db, rig.id)
    return _rig_to_response(full_rig)


@router.get("/{rig_id}", response_model=RigResponse)
async def get_rig_detail(rig_id: int, db: AsyncSession = Depends(get_db)):
    rig = await get_rig(db, rig_id)
    if not rig:
        raise HTTPException(status_code=404, detail="The requested rig could not be found. It may have been removed from the platform.")
    return _rig_to_response(rig)


@router.put("/{rig_id}", response_model=RigResponse)
async def update_rig_route(
    rig_id: int,
    data: RigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rig = await get_rig(db, rig_id)
    if not rig:
        raise HTTPException(status_code=404, detail="The requested rig could not be found. It may have been removed from the platform.")
    if rig.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to modify this rig.")
    updated = await update_rig(db, rig, **data.model_dump(exclude_unset=True))
    full_rig = await get_rig(db, updated.id)
    return _rig_to_response(full_rig)


@router.delete("/{rig_id}")
async def delete_rig_route(
    rig_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rig = await get_rig(db, rig_id)
    if not rig:
        raise HTTPException(status_code=404, detail="The requested rig could not be found. It may have been removed from the platform.")
    if rig.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to modify this rig.")
    await delete_rig(db, rig)
    return {"message": "Rig deleted"}
