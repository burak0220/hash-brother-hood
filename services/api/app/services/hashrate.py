"""Hashrate monitoring and validation service."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hashrate_log import HashrateLog
from app.models.rental import Rental


async def can_renter_cancel(db: AsyncSession, rental: Rental) -> tuple[bool, str]:
    """
    Check if renter can cancel based on hashrate performance.

    Rules:
    - Renter can cancel if average hashrate (1 hour) < 70% of advertised rate
    - Needs at least 1 hour of data to calculate

    Returns:
        (can_cancel: bool, reason: str)
    """
    if rental.status != "active":
        return True, "Rental is not active"

    if not rental.started_at:
        return True, "Rental not started yet"

    now = datetime.now(timezone.utc)
    elapsed = (now - rental.started_at).total_seconds() / 3600  # hours

    # Need at least 1 hour of runtime
    if elapsed < 1.0:
        return False, "Cannot cancel within first hour. Hashrate needs time to stabilize."

    # Get hashrate logs from the last hour
    one_hour_ago = now - timedelta(hours=1)

    result = await db.execute(
        select(func.avg(HashrateLog.measured_hashrate))
        .where(
            HashrateLog.rental_id == rental.id,
            HashrateLog.measured_at >= one_hour_ago
        )
    )
    avg_hashrate = result.scalar()

    # No hashrate data yet
    if avg_hashrate is None:
        return False, "No hashrate data available yet. Monitoring in progress..."

    # Calculate percentage
    advertised = float(rental.hashrate)
    measured = float(avg_hashrate)
    percentage = (measured / advertised) * 100

    # Threshold: 70%
    THRESHOLD = 70.0

    if percentage < THRESHOLD:
        return True, f"Hashrate below threshold: {percentage:.1f}% (measured: {measured:.2f}, advertised: {advertised:.2f})"
    else:
        return False, f"Hashrate is acceptable: {percentage:.1f}% of advertised rate"


async def log_hashrate(
    db: AsyncSession,
    rental_id: int,
    measured_hashrate: float,
    advertised_hashrate: float,
    source: str = "pool_api"
) -> HashrateLog:
    """Log a hashrate measurement."""
    percentage = (measured_hashrate / advertised_hashrate) * 100

    log = HashrateLog(
        rental_id=rental_id,
        measured_hashrate=measured_hashrate,
        advertised_hashrate=advertised_hashrate,
        percentage=percentage,
        source=source
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log


async def get_hashrate_stats(db: AsyncSession, rental_id: int, hours: int = 24) -> dict:
    """Get hashrate statistics for a rental."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    result = await db.execute(
        select(
            func.avg(HashrateLog.measured_hashrate).label("avg_hashrate"),
            func.min(HashrateLog.measured_hashrate).label("min_hashrate"),
            func.max(HashrateLog.measured_hashrate).label("max_hashrate"),
            func.avg(HashrateLog.percentage).label("avg_percentage"),
            func.count(HashrateLog.id).label("sample_count")
        )
        .where(
            HashrateLog.rental_id == rental_id,
            HashrateLog.measured_at >= since
        )
    )
    stats = result.one_or_none()

    if not stats or stats.sample_count == 0:
        return {
            "avg_hashrate": None,
            "min_hashrate": None,
            "max_hashrate": None,
            "avg_percentage": None,
            "sample_count": 0
        }

    return {
        "avg_hashrate": float(stats.avg_hashrate) if stats.avg_hashrate else None,
        "min_hashrate": float(stats.min_hashrate) if stats.min_hashrate else None,
        "max_hashrate": float(stats.max_hashrate) if stats.max_hashrate else None,
        "avg_percentage": float(stats.avg_percentage) if stats.avg_percentage else None,
        "sample_count": int(stats.sample_count)
    }
