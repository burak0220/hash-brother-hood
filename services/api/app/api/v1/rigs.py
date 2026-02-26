import math

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.rig import Rig
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
        # MRR fields
        "rpi_score": getattr(rig, "rpi_score", None) or 100,
        "suggested_difficulty": getattr(rig, "suggested_difficulty", None),
        "auto_price_enabled": getattr(rig, "auto_price_enabled", False),
        "auto_price_margin": getattr(rig, "auto_price_margin", 0),
        "owner_pool_url": getattr(rig, "owner_pool_url", None),
        "owner_pool_user": getattr(rig, "owner_pool_user", None),
        "owner_pool_password": getattr(rig, "owner_pool_password", None),
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
    min_hashrate: float | None = None,
    min_uptime: float | None = None,
    min_rating: float | None = None,
    db: AsyncSession = Depends(get_db),
):
    rigs, total = await list_marketplace_rigs(
        db, page=page, per_page=per_page, algorithm_id=algorithm_id,
        sort_by=sort_by, sort_order=sort_order, search=search,
        min_price=min_price, max_price=max_price,
        min_hashrate=min_hashrate, min_uptime=min_uptime, min_rating=min_rating,
    )
    return {
        "items": [_rig_to_response(r) for r in rigs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.get("/algo-stats")
async def algo_stats(db: AsyncSession = Depends(get_db)):
    """Return active+rented rig counts per algorithm_id for the marketplace tab bar."""
    from sqlalchemy import func as sqlfunc
    result = await db.execute(
        select(Rig.algorithm_id, sqlfunc.count(Rig.id).label("cnt"))
        .where(Rig.status.in_(["active", "rented"]))
        .group_by(Rig.algorithm_id)
    )
    return {str(row.algorithm_id): row.cnt for row in result.all()}


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


@router.get("/{rig_id}/hashrate-history")
async def get_rig_hashrate_history(
    rig_id: int,
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """Get recent hashrate history for a rig (public, for marketplace rig detail)."""
    from app.models.hashrate_log import HashrateLog
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select

    from app.models.rental import Rental

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    # HashrateLog has rental_id, not rig_id — join through rentals
    result = await db.execute(
        select(HashrateLog)
        .join(Rental, Rental.id == HashrateLog.rental_id)
        .where(Rental.rig_id == rig_id, HashrateLog.measured_at >= since)
        .order_by(HashrateLog.measured_at.asc())
        .limit(200)
    )
    logs = result.scalars().all()
    return [
        {
            "measured_hashrate": float(log.measured_hashrate),
            "percentage": float(log.percentage) if log.percentage else None,
            "recorded_at": log.measured_at.isoformat() if log.measured_at else None,
        }
        for log in logs
    ]


class BulkRigUpdate(BaseModel):
    rig_ids: list[int]
    price_per_hour: float | None = None
    status: str | None = None
    min_rental_hours: int | None = None
    max_rental_hours: int | None = None

@router.post("/bulk-update")
async def bulk_update_rigs(
    data: BulkRigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk update price/status for multiple rigs at once."""
    from decimal import Decimal

    if not data.rig_ids or len(data.rig_ids) > 50:
        raise HTTPException(400, "Provide 1-50 rig IDs")

    result = await db.execute(
        select(Rig).where(Rig.id.in_(data.rig_ids), Rig.owner_id == user.id)
    )
    rigs = result.scalars().all()
    if not rigs:
        raise HTTPException(404, "No rigs found")

    updated = 0
    for rig in rigs:
        if data.price_per_hour is not None:
            rig.price_per_hour = Decimal(str(data.price_per_hour))
        if data.status is not None and data.status in ("active", "disabled"):
            rig.status = data.status
        if data.min_rental_hours is not None:
            rig.min_rental_hours = data.min_rental_hours
        if data.max_rental_hours is not None:
            rig.max_rental_hours = data.max_rental_hours
        updated += 1

    await db.commit()
    return {"updated": updated, "total": len(data.rig_ids)}
