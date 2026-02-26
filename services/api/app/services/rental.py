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
    pool2_url: str | None = None, pool2_user: str | None = None, pool2_password: str | None = None,
    pool3_url: str | None = None, pool3_user: str | None = None, pool3_password: str | None = None,
    pool4_url: str | None = None, pool4_user: str | None = None, pool4_password: str | None = None,
    pool5_url: str | None = None, pool5_user: str | None = None, pool5_password: str | None = None,
) -> Rental:
    result = await db.execute(
        select(Rig).options(selectinload(Rig.algorithm)).where(Rig.id == rig_id)
    )
    rig = result.scalar_one_or_none()
    if not rig:
        raise ValueError("The requested mining rig could not be found. It may have been removed.")
    if rig.status != "active":
        raise ValueError("This rig is currently unavailable for rental. It may already be rented or under maintenance.")
    if rig.owner_id == renter.id:
        raise ValueError("You cannot rent your own rig. Please select a different one from the marketplace.")
    if duration_hours < rig.min_rental_hours or duration_hours > rig.max_rental_hours:
        raise ValueError(f"Rental duration must be between {rig.min_rental_hours} and {rig.max_rental_hours} hours for this rig.")

    total_cost = rig.price_per_hour * Decimal(str(duration_hours))
    renter_fee_pct = Decimal(str(settings.RENTER_FEE_PERCENT)) / Decimal("100")
    renter_fee = (total_cost * renter_fee_pct).quantize(Decimal("0.01"))
    total_with_fee = total_cost + renter_fee

    # Row-level lock to prevent double-spend race condition
    locked_renter = await db.execute(
        select(User).where(User.id == renter.id).with_for_update()
    )
    renter = locked_renter.scalar_one()

    if renter.balance < total_with_fee:
        raise ValueError(f"Insufficient balance. Rental cost: {total_cost} + {renter_fee} fee = {total_with_fee} LTC")

    renter.balance -= total_with_fee

    now = datetime.now(timezone.utc)
    rental = Rental(
        rig_id=rig.id,
        renter_id=renter.id,
        owner_id=rig.owner_id,
        algorithm_id=rig.algorithm_id,
        hashrate=rig.hashrate,
        price_per_hour=rig.price_per_hour,
        duration_hours=duration_hours,
        original_duration_hours=duration_hours,
        total_cost=total_cost,
        escrow_amount=total_cost,  # Lock full amount in escrow
        status="active",
        rpi_at_start=rig.rpi_score,
        pool_url=pool_url,
        pool_user=pool_user,
        pool_password=pool_password,
        pool2_url=pool2_url,
        pool2_user=pool2_user,
        pool2_password=pool2_password,
        pool3_url=pool3_url,
        pool3_user=pool3_user,
        pool3_password=pool3_password,
        pool4_url=pool4_url,
        pool4_user=pool4_user,
        pool4_password=pool4_password,
        pool5_url=pool5_url,
        pool5_user=pool5_user,
        pool5_password=pool5_password,
        started_at=now,
        ends_at=now + timedelta(hours=duration_hours),
    )
    db.add(rental)

    rig.status = "rented"
    rig.total_rentals += 1

    # Transaction: renter pays into escrow + fee
    tx_renter = Transaction(
        user_id=renter.id, type="escrow_lock", amount=total_with_fee,
        status="completed", description=f"Escrow {total_cost} + fee {renter_fee} for rig #{rig.id}",
        reference_id=str(rental.id) if rental.id else None,
    )
    db.add(tx_renter)

    # Renter fee transaction (platform revenue)
    if renter_fee > 0:
        tx_fee = Transaction(
            user_id=renter.id, type="renter_fee", amount=renter_fee,
            status="completed", description=f"3% service fee for rental of rig #{rig.id}",
        )
        db.add(tx_fee)

    # Owner does NOT get paid yet — escrow releases after rental completes + review window

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
        raise ValueError("This rental cannot be cancelled in its current state.")

    now = datetime.now(timezone.utc)
    original_status = rental.status

    # Use escrow_amount (original cost only — extensions are settled immediately to owner)
    escrow = rental.escrow_amount or rental.total_cost
    renter_fee_pct = Decimal(str(settings.RENTER_FEE_PERCENT)) / Decimal("100")
    original_renter_fee = (escrow * renter_fee_pct).quantize(Decimal("0.01"))

    # Calculate refund based on escrow and original duration (not extended ends_at)
    if original_status == "active" and rental.started_at:
        original_duration_hours = rental.original_duration_hours or rental.duration_hours or 0
        original_total_seconds = original_duration_hours * 3600
        used_seconds = max((now - rental.started_at).total_seconds(), 0)
        if original_total_seconds > 0 and used_seconds < original_total_seconds:
            unused_ratio = max(Decimal(str(1 - used_seconds / original_total_seconds)), Decimal("0"))
        else:
            unused_ratio = Decimal("0")
        refund_amount = (escrow * unused_ratio).quantize(Decimal("0.01"))
        fee_refund = (original_renter_fee * unused_ratio).quantize(Decimal("0.01"))
    else:
        # Pending rental = full refund including fee
        refund_amount = escrow
        fee_refund = original_renter_fee

    total_refund = refund_amount + fee_refund

    rental.status = "cancelled"
    rental.cancelled_at = now

    fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")

    # Refund renter: unused escrow portion + proportional fee refund
    renter_result = await db.execute(select(User).where(User.id == rental.renter_id))
    renter = renter_result.scalar_one()
    renter.balance += total_refund

    tx = Transaction(
        user_id=renter.id, type="refund", amount=total_refund,
        status="completed", description=f"Refund for cancelled rental #{rental.id}",
    )
    db.add(tx)

    # Pay owner for delivered portion (from escrow only, extensions already settled)
    used_amount = escrow - refund_amount
    if used_amount > Decimal("0.00"):
        platform_fee = (used_amount * fee_percent).quantize(Decimal("0.01"))
        owner_earning = used_amount - platform_fee

        owner_result = await db.execute(select(User).where(User.id == rental.owner_id))
        owner = owner_result.scalar_one()
        owner.balance += owner_earning

        tx_owner = Transaction(
            user_id=rental.owner_id, type="rental_earning", amount=owner_earning,
            status="completed", description=f"Partial earning for cancelled rental #{rental.id} ({used_amount} LTC delivered)",
        )
        db.add(tx_owner)

    # Restore rig
    rig_result = await db.execute(select(Rig).where(Rig.id == rental.rig_id))
    rig = rig_result.scalar_one()
    rig.status = "active"

    await db.flush()
    await db.refresh(rental)
    return rental


async def extend_rental(db: AsyncSession, rental: Rental, user: User, hours: int) -> Rental:
    """Extend an active rental's duration. Only the renter can extend."""
    if rental.status != "active":
        raise ValueError("Only active rentals can be extended.")
    if rental.renter_id != user.id:
        raise ValueError("Only the renter can extend a rental.")
    if rental.extensions_disabled:
        raise ValueError("Extensions have been disabled for this rental.")

    # Check max hours from the rig
    rig_result = await db.execute(select(Rig).where(Rig.id == rental.rig_id))
    rig = rig_result.scalar_one_or_none()
    if not rig:
        raise ValueError("Rig not found.")

    current_total = (rental.original_duration_hours or rental.duration_hours) + rental.extended_hours
    new_total = current_total + hours
    if new_total > rig.max_rental_hours:
        max_extend = rig.max_rental_hours - current_total
        raise ValueError(f"Cannot extend beyond max rental hours ({rig.max_rental_hours}h). You can extend by up to {max_extend}h more.")

    # Calculate extension cost at current price
    ext_cost = rental.price_per_hour * Decimal(str(hours))

    # Renter pays ext_cost + 3% renter fee (double-sided fee model)
    renter_fee_pct = Decimal(str(settings.RENTER_FEE_PERCENT)) / Decimal("100")
    renter_fee = (ext_cost * renter_fee_pct).quantize(Decimal("0.01"))
    ext_total_with_fee = ext_cost + renter_fee

    # Lock renter balance
    locked_renter = await db.execute(select(User).where(User.id == user.id).with_for_update())
    renter = locked_renter.scalar_one()
    if renter.balance < ext_total_with_fee:
        raise ValueError(f"Insufficient balance for extension. Cost: {ext_cost} + {renter_fee} fee = {ext_total_with_fee} LTC")

    renter.balance -= ext_total_with_fee

    # Update rental
    rental.duration_hours = (rental.duration_hours or 0) + hours
    rental.extended_hours += hours
    rental.extension_cost += ext_cost
    rental.total_cost += ext_cost
    rental.ends_at = rental.ends_at + timedelta(hours=hours) if rental.ends_at else None

    # Record extension
    from app.models.rental_extension import RentalExtension
    ext = RentalExtension(
        rental_id=rental.id,
        hours=hours,
        price_per_hour=rental.price_per_hour,
        total_cost=ext_cost,
    )
    db.add(ext)

    # Payment to owner (minus platform fee — owner also pays 3%)
    fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
    platform_fee = ext_cost * fee_percent
    owner_earning = ext_cost - platform_fee

    owner_result = await db.execute(select(User).where(User.id == rental.owner_id))
    owner = owner_result.scalar_one()
    owner.balance += owner_earning

    # Transactions
    tx_renter = Transaction(
        user_id=renter.id, type="rental_extension", amount=ext_total_with_fee,
        status="completed", description=f"Extension payment for rental #{rental.id} (+{hours}h): {ext_cost} + {renter_fee} fee",
    )
    tx_fee = Transaction(
        user_id=renter.id, type="renter_fee", amount=renter_fee,
        status="completed", description=f"3% service fee for extension of rental #{rental.id}",
    )
    tx_owner = Transaction(
        user_id=owner.id, type="rental_earning", amount=owner_earning,
        status="completed", description=f"Extension earning from rental #{rental.id} (+{hours}h)",
    )
    db.add(tx_renter)
    db.add(tx_fee)
    db.add(tx_owner)

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
        "rig_region": rental.rig.region if rental.rig else None,
        "renter_id": rental.renter_id,
        "owner_id": rental.owner_id,
        "algorithm_id": rental.algorithm_id,
        "algorithm_name": rental.algorithm.display_name if rental.algorithm else None,
        "hashrate": rental.hashrate,
        "price_per_hour": rental.price_per_hour,
        "duration_hours": rental.duration_hours,
        "total_cost": rental.total_cost,
        "escrow_amount": rental.escrow_amount or rental.total_cost,
        "escrow_released": rental.escrow_released,
        "status": rental.status,
        # 5-pool failover
        "pool_url": rental.pool_url,
        "pool_user": rental.pool_user,
        "pool_password": rental.pool_password,
        "pool2_url": rental.pool2_url,
        "pool2_user": rental.pool2_user,
        "pool2_password": rental.pool2_password,
        "pool3_url": rental.pool3_url,
        "pool3_user": rental.pool3_user,
        "pool3_password": rental.pool3_password,
        "pool4_url": rental.pool4_url,
        "pool4_user": rental.pool4_user,
        "pool4_password": rental.pool4_password,
        "pool5_url": rental.pool5_url,
        "pool5_user": rental.pool5_user,
        "pool5_password": rental.pool5_password,
        "actual_hashrate_avg": rental.actual_hashrate_avg,
        "performance_percent": rental.performance_percent,
        # Extension info
        "original_duration_hours": rental.original_duration_hours,
        "extended_hours": rental.extended_hours,
        "extension_cost": rental.extension_cost,
        "extensions_disabled": rental.extensions_disabled,
        # Share-based refund
        "expected_shares": rental.expected_shares,
        "actual_shares": rental.actual_shares,
        "rejected_shares": rental.rejected_shares,
        "refund_amount": rental.refund_amount,
        "refund_reason": rental.refund_reason,
        "reviewed_at": rental.reviewed_at,
        # RPI snapshot
        "rpi_at_start": rental.rpi_at_start,
        # Timestamps
        "dispute_window_ends": rental.dispute_window_ends,
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
