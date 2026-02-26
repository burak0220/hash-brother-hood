"""
RPI (Rig Performance Index) calculation service.

Scoring (0-100):
- Hashrate Delivery (40 points): avg hashrate vs advertised across all completed rentals
- Uptime Score (30 points): percentage of time rig was online during rentals
- Refund History (20 points): fewer refunds = higher score
- Rental Volume (10 points): more completed rentals = higher confidence

New rigs start at 100 (benefit of the doubt), score adjusts after first rental.
Pool-caused issues are excluded (only rig-side problems count).
"""
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rig import Rig
from app.models.rental import Rental
from app.models.hashrate_log import HashrateLog


async def calculate_rpi(db: AsyncSession, rig_id: int) -> Decimal:
    """Calculate RPI score for a rig based on rental history."""

    # Get completed rentals for this rig
    result = await db.execute(
        select(Rental).where(
            Rental.rig_id == rig_id,
            Rental.status.in_(["completed", "cancelled"]),
        )
    )
    rentals = result.scalars().all()

    if not rentals:
        return Decimal("100.00")  # New rig, benefit of the doubt

    completed = [r for r in rentals if r.status == "completed"]
    total_rentals = len(completed)

    if total_rentals == 0:
        return Decimal("100.00")

    # 1. Hashrate Delivery Score (40 points)
    hashrate_scores = []
    for r in completed:
        if r.performance_percent is not None:
            pct = min(float(r.performance_percent), 100.0)  # Cap at 100%
            hashrate_scores.append(pct)

    if hashrate_scores:
        avg_delivery = sum(hashrate_scores) / len(hashrate_scores)
        # Scale: 95%+ = full marks, <70% = 0
        hashrate_points = max(0, min(40, (avg_delivery - 70) / (95 - 70) * 40))
    else:
        hashrate_points = 40  # No data, assume good

    # 2. Uptime Score (30 points)
    # Count how many rentals had issues (auto_cancelled or low performance)
    auto_cancelled = sum(1 for r in rentals if r.auto_cancelled)
    low_perf = sum(1 for r in completed if r.performance_percent and float(r.performance_percent) < 70)
    problem_rentals = auto_cancelled + low_perf
    problem_ratio = problem_rentals / max(len(rentals), 1)
    uptime_points = max(0, 30 * (1 - problem_ratio * 2))  # Double penalty

    # 3. Refund History (20 points)
    refunded = sum(1 for r in completed if r.refund_amount and float(r.refund_amount) > 0)
    refund_ratio = refunded / max(total_rentals, 1)
    refund_points = max(0, 20 * (1 - refund_ratio * 3))  # Triple penalty for refunds

    # 4. Rental Volume Bonus (10 points)
    # More rentals = more confidence. 10+ rentals = full marks
    volume_points = min(10, total_rentals)

    # Total RPI
    rpi = hashrate_points + uptime_points + refund_points + volume_points
    return Decimal(str(round(max(0, min(100, rpi)), 2)))


async def update_rig_rpi(db: AsyncSession, rig_id: int) -> Decimal:
    """Calculate and update a rig's RPI score."""
    rpi = await calculate_rpi(db, rig_id)
    result = await db.execute(select(Rig).where(Rig.id == rig_id))
    rig = result.scalar_one_or_none()
    if rig:
        rig.rpi_score = rpi
        await db.flush()
    return rpi


async def update_all_rpis(db: AsyncSession) -> int:
    """Recalculate RPI for all rigs. Called by scheduler."""
    result = await db.execute(select(Rig.id))
    rig_ids = [row[0] for row in result.all()]
    count = 0
    for rig_id in rig_ids:
        await update_rig_rpi(db, rig_id)
        count += 1
    return count
