from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.rental import Rental
from app.models.rig import Rig
from app.models.user import User
from app.models.transaction import Transaction


async def create_rental(
    db: AsyncSession, renter: User, rig_id: int,
    duration_hours: int, pool_url: str, pool_user: str, pool_password: str = "x",
) -> Rental:
    result = await db.execute(
        select(Rig).options(selectinload(Rig.algorithm)).where(Rig.id == rig_id)
    )
    rig = result.scalar_one_or_none()
    if not rig:
        raise ValueError("Rig not found")
    if rig.status != "active":
        raise ValueError("Rig is not available")
    if rig.owner_id == renter.id:
        raise ValueError("Cannot rent your own rig")
    if duration_hours < rig.min_rental_hours or duration_hours > rig.max_rental_hours:
        raise ValueError(f"Duration must be between {rig.min_rental_hours} and {rig.max_rental_hours} hours")

    total_cost = rig.price_per_hour * Decimal(str(duration_hours))

    # Row-level lock to prevent double-spend race condition
    locked_renter = await db.execute(
        select(User).where(User.id == renter.id).with_for_update()
    )
    renter = locked_renter.scalar_one()

    if renter.balance < total_cost:
        raise ValueError("Insufficient balance")

    renter.balance -= total_cost

    now = datetime.now(timezone.utc)
    rental = Rental(
        rig_id=rig.id,
        renter_id=renter.id,
        owner_id=rig.owner_id,
        algorithm_id=rig.algorithm_id,
        hashrate=rig.hashrate,
        price_per_hour=rig.price_per_hour,
        duration_hours=duration_hours,
        total_cost=total_cost,
        status="active",
        pool_url=pool_url,
        pool_user=pool_user,
        pool_password=pool_password,
        started_at=now,
        ends_at=now + timedelta(hours=duration_hours),
    )
    db.add(rental)

    rig.status = "rented"
    rig.total_rentals += 1

    # Create transaction for renter
    tx_renter = Transaction(
        user_id=renter.id, type="rental_payment", amount=total_cost,
        status="completed", description=f"Rental payment for rig #{rig.id}",
        reference_id=str(rental.id) if rental.id else None,
    )
    db.add(tx_renter)

    # Platform fee from config (not hardcoded)
    fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
    platform_fee = total_cost * fee_percent
    owner_earning = total_cost - platform_fee

    owner_result = await db.execute(select(User).where(User.id == rig.owner_id))
    owner = owner_result.scalar_one()
    owner.balance += owner_earning

    tx_owner = Transaction(
        user_id=rig.owner_id, type="rental_earning", amount=owner_earning,
        status="completed", description=f"Earning from rig #{rig.id} rental",
    )
    db.add(tx_owner)

    await db.flush()
    await db.refresh(rental)
    return rental


async def get_rental(db: AsyncSession, rental_id: int) -> Rental | None:
    result = await db.execute(
        select(Rental)
        .options(
            selectinload(Rental.rig).selectinload(Rig.algorithm),
            selectinload(Rental.renter),
            selectinload(Rental.owner),
            selectinload(Rental.algorithm),
        )
        .where(Rental.id == rental_id)
    )
    return result.scalar_one_or_none()


async def cancel_rental(db: AsyncSession, rental: Rental, user: User) -> Rental:
    if rental.status not in ("pending", "active"):
        raise ValueError("Rental cannot be cancelled")

    rental.status = "cancelled"
    rental.cancelled_at = datetime.now(timezone.utc)

    # Refund renter
    renter_result = await db.execute(select(User).where(User.id == rental.renter_id))
    renter = renter_result.scalar_one()
    renter.balance += rental.total_cost

    tx = Transaction(
        user_id=renter.id, type="refund", amount=rental.total_cost,
        status="completed", description=f"Refund for cancelled rental #{rental.id}",
    )
    db.add(tx)

    # Deduct owner earning (reverse the payment)
    fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
    platform_fee = rental.total_cost * fee_percent
    owner_earning = rental.total_cost - platform_fee

    owner_result = await db.execute(select(User).where(User.id == rental.owner_id))
    owner = owner_result.scalar_one()
    owner.balance -= owner_earning

    tx_owner_refund = Transaction(
        user_id=rental.owner_id, type="refund", amount=owner_earning,
        status="completed", description=f"Earning reversed for cancelled rental #{rental.id}",
    )
    db.add(tx_owner_refund)

    # Restore rig
    rig_result = await db.execute(select(Rig).where(Rig.id == rental.rig_id))
    rig = rig_result.scalar_one()
    rig.status = "active"

    await db.flush()
    await db.refresh(rental)
    return rental


async def list_user_rentals(
    db: AsyncSession, user_id: int, role: str = "renter",
    page: int = 1, per_page: int = 20,
) -> tuple[list[Rental], int]:
    if role == "renter":
        condition = Rental.renter_id == user_id
    else:
        condition = Rental.owner_id == user_id

    query = (
        select(Rental)
        .options(
            selectinload(Rental.rig).selectinload(Rig.algorithm),
            selectinload(Rental.renter),
            selectinload(Rental.owner),
            selectinload(Rental.algorithm),
        )
        .where(condition)
        .order_by(Rental.created_at.desc())
    )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total


def rental_to_response(rental: Rental) -> dict:
    data = {
        "id": rental.id,
        "rig_id": rental.rig_id,
        "rig_name": rental.rig.name if rental.rig else None,
        "renter_id": rental.renter_id,
        "owner_id": rental.owner_id,
        "algorithm_id": rental.algorithm_id,
        "algorithm_name": rental.algorithm.display_name if rental.algorithm else None,
        "hashrate": rental.hashrate,
        "price_per_hour": rental.price_per_hour,
        "duration_hours": rental.duration_hours,
        "total_cost": rental.total_cost,
        "status": rental.status,
        "pool_url": rental.pool_url,
        "pool_user": rental.pool_user,
        "pool_password": rental.pool_password,
        "started_at": rental.started_at,
        "ends_at": rental.ends_at,
        "completed_at": rental.completed_at,
        "cancelled_at": rental.cancelled_at,
        "created_at": rental.created_at,
        "updated_at": rental.updated_at,
    }
    if rental.renter:
        data["renter"] = {
            "id": rental.renter.id,
            "username": rental.renter.username,
            "avatar_url": rental.renter.avatar_url,
            "bio": rental.renter.bio,
            "created_at": rental.renter.created_at,
        }
    if rental.owner:
        data["owner"] = {
            "id": rental.owner.id,
            "username": rental.owner.username,
            "avatar_url": rental.owner.avatar_url,
            "bio": rental.owner.bio,
            "created_at": rental.owner.created_at,
        }
    return data
