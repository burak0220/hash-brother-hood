from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.rig import Rig
from app.models.algorithm import Algorithm

# Whitelist of allowed sort columns to prevent SQL injection
ALLOWED_SORT_COLUMNS = {
    "created_at", "price_per_hour", "hashrate", "name",
    "average_rating", "total_rentals", "uptime_percentage", "rpi_score",
}


async def create_rig(db: AsyncSession, owner_id: int, **kwargs) -> Rig:
    rig = Rig(owner_id=owner_id, **kwargs)
    db.add(rig)
    await db.flush()

    # Auto-assign stratum connection info if not set
    if not rig.stratum_host or not rig.stratum_port:
        from app.core.config import settings
        rig.stratum_host = settings.STRATUM_HOST
        # Port = base_port + rig_id (unique per rig)
        rig.stratum_port = settings.STRATUM_BASE_PORT + rig.id
        await db.flush()

    await db.refresh(rig)
    return rig


async def get_rig(db: AsyncSession, rig_id: int) -> Rig | None:
    result = await db.execute(
        select(Rig)
        .options(selectinload(Rig.algorithm), selectinload(Rig.owner), selectinload(Rig.reviews))
        .where(Rig.id == rig_id)
    )
    return result.scalar_one_or_none()


async def update_rig(db: AsyncSession, rig: Rig, **kwargs) -> Rig:
    for key, value in kwargs.items():
        if value is not None and hasattr(rig, key):
            setattr(rig, key, value)
    await db.flush()
    await db.refresh(rig)
    return rig


async def delete_rig(db: AsyncSession, rig: Rig) -> None:
    await db.delete(rig)
    await db.flush()


async def list_marketplace_rigs(
    db: AsyncSession, page: int = 1, per_page: int = 20,
    algorithm_id: int | None = None, sort_by: str = "created_at",
    sort_order: str = "desc", search: str | None = None,
    min_price: float | None = None, max_price: float | None = None,
    min_hashrate: float | None = None, min_uptime: float | None = None,
    min_rating: float | None = None,
) -> tuple[list[Rig], int]:
    query = select(Rig).options(selectinload(Rig.algorithm), selectinload(Rig.owner)).where(Rig.status.in_(["active", "rented"]))

    if algorithm_id:
        query = query.where(Rig.algorithm_id == algorithm_id)
    if search:
        query = query.where(Rig.name.ilike(f"%{search}%"))
    if min_price is not None:
        query = query.where(Rig.price_per_hour >= min_price)
    if max_price is not None:
        query = query.where(Rig.price_per_hour <= max_price)
    if min_hashrate is not None:
        query = query.where(Rig.hashrate >= min_hashrate)
    if min_uptime is not None:
        query = query.where(Rig.uptime_percentage >= min_uptime)
    if min_rating is not None:
        query = query.where(Rig.average_rating >= min_rating)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort column whitelist to prevent injection
    if sort_by not in ALLOWED_SORT_COLUMNS:
        sort_by = "created_at"
    sort_col = getattr(Rig, sort_by, Rig.created_at)

    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def list_user_rigs(db: AsyncSession, owner_id: int) -> list[Rig]:
    result = await db.execute(
        select(Rig).options(selectinload(Rig.algorithm))
        .where(Rig.owner_id == owner_id)
        .order_by(Rig.created_at.desc())
    )
    return list(result.scalars().all())
