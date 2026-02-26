"""Background scheduler to handle rental expiry, LTC deposit scanning, UTXO sweep, and other periodic tasks."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session as async_session_factory
from app.core.config import settings
from app.models.rental import Rental
from app.models.rig import Rig
from app.models.user import User
from app.models.transaction import Transaction
from app.services.blockchain import _get_address_utxos_sync

logger = logging.getLogger(__name__)


async def scan_deposits():
    """Scan user deposit addresses for incoming LTC transfers via Blockchair API."""
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(User).where(User.deposit_address.isnot(None))
            )
            users = result.scalars().all()

            if not users:
                return

            deposits_found = 0

            for user in users:
                try:
                    utxos = await asyncio.to_thread(
                        _get_address_utxos_sync, user.deposit_address
                    )
                    # 350ms between addresses — stay within BlockCypher free tier (3 req/s)
                    await asyncio.sleep(0.35)
                except Exception as e:
                    logger.warning(f"UTXO scan failed for {user.deposit_address}: {e}")
                    continue

                # Only process UTXOs with enough confirmations (MRR standard: 3)
                confirmed = [u for u in utxos if u["confirmations"] >= settings.DEPOSIT_MIN_CONFIRMATIONS]

                for utxo in confirmed:
                    tx_hash = utxo["txid"]
                    amount  = Decimal(str(utxo["amount"]))

                    if amount <= 0:
                        continue

                    # Check if we already processed this UTXO
                    existing = await db.execute(
                        select(Transaction).where(
                            Transaction.user_id == user.id,
                            Transaction.tx_hash == tx_hash,
                            Transaction.type == "deposit",
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue

                    # Credit user balance
                    user.balance += amount
                    db.add(Transaction(
                        user_id=user.id,
                        type="deposit",
                        amount=amount,
                        status="completed",
                        tx_hash=tx_hash,
                        description=f"LTC deposit to {user.deposit_address[:12]}...",
                    ))
                    deposits_found += 1
                    logger.info(
                        f"Deposit: user {user.id} +{float(amount)} LTC (tx: {tx_hash})"
                    )

            if deposits_found > 0:
                await db.commit()
                logger.info(f"Processed {deposits_found} new LTC deposits")

    except Exception as e:
        logger.error(f"Deposit scan error: {e}")


async def sweep_deposits():
    """
    Sweep LTC from user deposit addresses to hot wallet.
    Uses UTXO batching: multiple inputs → single output = minimal fee.
    """
    if not settings.SWEEP_ENABLED:
        return

    if not settings.HOT_WALLET_ADDRESS:
        return

    try:
        from app.services.hdwallet import derive_private_key

        async with async_session_factory() as db:
            result = await db.execute(
                select(User).where(
                    User.deposit_address.isnot(None),
                    User.deposit_hd_index.isnot(None),
                )
            )
            users = result.scalars().all()

            if not users:
                return

            # Collect addresses with >= SWEEP_MIN_LTC confirmed and ready to sweep
            address_key_pairs = []
            for user in users:
                try:
                    utxos = await asyncio.to_thread(
                        _get_address_utxos_sync, user.deposit_address
                    )
                    sweepable_total = sum(
                        u["amount"] for u in utxos
                        if u["confirmations"] >= settings.SWEEP_MIN_CONFIRMATIONS
                    )
                except Exception:
                    continue

                if sweepable_total >= settings.SWEEP_MIN_LTC:
                    wif = derive_private_key(user.deposit_hd_index)
                    address_key_pairs.append((user.deposit_address, wif))

            if not address_key_pairs:
                return

            # Execute sweep
            from app.services.blockchain import sweep_addresses

            sweep_result = await sweep_addresses(
                address_key_pairs, settings.HOT_WALLET_ADDRESS
            )

            if sweep_result.get("success"):
                logger.info(
                    f"Sweep completed: {sweep_result['utxo_count']} UTXOs, "
                    f"{sweep_result['total_swept']} LTC swept, "
                    f"fee: {sweep_result['fee']} LTC, tx: {sweep_result['tx_hash']}"
                )
            elif sweep_result.get("error") != "No UTXOs found to sweep":
                logger.warning(f"Sweep failed: {sweep_result.get('error')}")

    except Exception as e:
        logger.error(f"Sweep error: {e}")


async def expire_rentals():
    """Mark expired rentals as completed with performance stats, and restore rig status."""
    from app.models.hashrate_log import HashrateLog

    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)

        # Find active rentals that have passed their end time
        result = await db.execute(
            select(Rental).where(
                Rental.status == "active",
                Rental.ends_at <= now,
            )
        )
        expired_rentals = result.scalars().all()

        for rental in expired_rentals:
            rental.status = "completed"
            rental.completed_at = now
            # Set 12-hour escrow hold (MRR style: owner paid after 12h)
            rental.dispute_window_ends = now + timedelta(hours=12)

            # Calculate actual average hashrate and performance %
            stats_result = await db.execute(
                select(
                    func.avg(HashrateLog.measured_hashrate).label("avg_hr"),
                    func.avg(HashrateLog.percentage).label("avg_pct"),
                ).where(HashrateLog.rental_id == rental.id)
            )
            stats = stats_result.one_or_none()
            if stats and stats.avg_hr is not None:
                rental.actual_hashrate_avg = Decimal(str(round(float(stats.avg_hr), 4)))
                rental.performance_percent = Decimal(str(round(float(stats.avg_pct), 2)))

            # Restore rig to active
            await db.execute(
                update(Rig).where(Rig.id == rental.rig_id).values(status="active")
            )
            logger.info(f"Rental #{rental.id} expired and marked as completed (perf: {rental.performance_percent}%)")

        if expired_rentals:
            await db.commit()
            logger.info(f"Processed {len(expired_rentals)} expired rentals")


async def process_rental_reviews():
    """
    Process completed rentals after 12-hour review window.
    Release escrow to owner based on performance, calculate refunds.
    """
    from app.services.rpi import update_rig_rpi

    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)

        # Find completed rentals past the 12h review window that haven't been reviewed yet
        result = await db.execute(
            select(Rental).where(
                Rental.status == "completed",
                Rental.dispute_window_ends <= now,
                Rental.reviewed_at.is_(None),
                Rental.escrow_released.is_(False),
            )
        )
        rentals_to_review = result.scalars().all()

        for rental in rentals_to_review:
            rental.reviewed_at = now
            escrow = rental.escrow_amount or rental.total_cost
            fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")

            refund = Decimal("0")
            perf = float(rental.performance_percent) if rental.performance_percent is not None else 100.0

            # MRR-style: pure prorated refund based on delivery
            # 100% delivered = 0% refund, 70% delivered = 30% refund, 0% delivered = 100% refund
            if perf < 95.0:
                missing_pct = (100.0 - perf) / 100.0
                refund = Decimal(str(round(float(escrow) * missing_pct, 2)))
                if refund < Decimal("0.01"):
                    refund = Decimal("0")

            # Owner gets escrow minus refund minus platform fee
            owner_amount = escrow - refund
            platform_fee = owner_amount * fee_percent
            owner_earning = owner_amount - platform_fee

            # Release to owner
            if owner_earning > 0:
                owner_result = await db.execute(select(User).where(User.id == rental.owner_id))
                owner = owner_result.scalar_one_or_none()
                if owner:
                    owner.balance += owner_earning
                    db.add(Transaction(
                        user_id=owner.id, type="escrow_release", amount=owner_earning,
                        status="completed",
                        description=f"Escrow released for rental #{rental.id} ({perf:.1f}% delivery)"
                    ))

            # Refund renter if applicable
            if refund > 0:
                rental.refund_amount = refund
                rental.refund_reason = f"Auto-refund: rig delivered {perf:.1f}% of advertised hashrate"

                renter_result = await db.execute(select(User).where(User.id == rental.renter_id))
                renter = renter_result.scalar_one_or_none()
                if renter:
                    renter.balance += refund
                    db.add(Transaction(
                        user_id=renter.id, type="refund", amount=refund,
                        status="completed",
                        description=f"Auto-refund for rental #{rental.id}: {perf:.1f}% hashrate delivery"
                    ))
                logger.info(f"Rental #{rental.id} refund: {refund} LTC ({perf:.1f}% delivery)")

            # Mark escrow as released
            rental.escrow_released = True
            rental.escrow_released_at = now

            # Referral bonus: if renter was referred, give referrer 1% of rental cost
            renter_for_ref = await db.execute(select(User).where(User.id == rental.renter_id))
            renter_ref = renter_for_ref.scalar_one_or_none()
            if renter_ref and renter_ref.referred_by:
                ref_bonus = escrow * Decimal("0.01")
                if ref_bonus >= Decimal("0.01"):
                    referrer_result = await db.execute(select(User).where(User.id == renter_ref.referred_by))
                    referrer = referrer_result.scalar_one_or_none()
                    if referrer:
                        referrer.balance += ref_bonus
                        db.add(Transaction(
                            user_id=referrer.id, type="referral_bonus", amount=ref_bonus,
                            status="completed",
                            description=f"Referral bonus from rental #{rental.id}"
                        ))
                        logger.info(f"Referral bonus {ref_bonus} LTC to user #{referrer.id} for rental #{rental.id}")

            # Update rig RPI after review
            await update_rig_rpi(db, rental.rig_id)
            logger.info(f"Rental #{rental.id} escrow released: owner={owner_earning}, refund={refund}, fee={platform_fee}")

        if rentals_to_review:
            await db.commit()
            logger.info(f"Reviewed {len(rentals_to_review)} completed rentals")


async def auto_cancel_low_hashrate():
    """
    Auto-cancel rentals if rig is offline/low-hashrate in first 30 minutes.
    Rule: If rig is offline for 20+ minutes in the first 30 minutes -> auto cancel + full refund.
    """
    from app.models.hashrate_log import HashrateLog
    from app.models.transaction import Transaction

    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        thirty_mins_ago = now - timedelta(minutes=30)

        # Find active rentals started within the last 30 minutes
        result = await db.execute(
            select(Rental).where(
                Rental.status == "active",
                Rental.started_at >= thirty_mins_ago,
                Rental.auto_cancelled == False,
            )
        )
        early_rentals = result.scalars().all()

        for rental in early_rentals:
            if not rental.started_at:
                continue

            elapsed_minutes = (now - rental.started_at).total_seconds() / 60
            if elapsed_minutes < 20:
                # Not enough time to evaluate
                continue

            # Count minutes with hashrate data (1 sample per minute assumed)
            data_result = await db.execute(
                select(func.count(HashrateLog.id)).where(
                    HashrateLog.rental_id == rental.id,
                    HashrateLog.measured_hashrate > 0,
                )
            )
            active_minutes = data_result.scalar() or 0

            total_result = await db.execute(
                select(func.count(HashrateLog.id)).where(HashrateLog.rental_id == rental.id)
            )
            total_samples = total_result.scalar() or 0

            # If we have at least some samples but rig was offline >20 of first 30 min
            if total_samples > 0:
                offline_minutes = elapsed_minutes - active_minutes
            else:
                offline_minutes = elapsed_minutes  # No data = all offline

            if offline_minutes >= 20:
                # Auto-cancel with full refund
                rental.status = "cancelled"
                rental.cancelled_at = now
                rental.auto_cancelled = True

                # Full refund of escrow only (extensions already settled to owner separately)
                escrow = rental.escrow_amount or rental.total_cost
                renter_fee_pct = Decimal(str(settings.RENTER_FEE_PERCENT)) / Decimal("100")
                renter_fee = (escrow * renter_fee_pct).quantize(Decimal("0.01"))
                full_refund = escrow + renter_fee

                renter_result = await db.execute(select(User).where(User.id == rental.renter_id))
                renter = renter_result.scalar_one_or_none()
                if renter:
                    renter.balance += full_refund
                    db.add(Transaction(
                        user_id=renter.id, type="refund", amount=full_refund,
                        status="completed",
                        description=f"Auto-cancel full refund for rental #{rental.id} (rig offline {offline_minutes:.0f}min in first 30min)"
                    ))

                # Restore rig
                await db.execute(update(Rig).where(Rig.id == rental.rig_id).values(status="active"))
                logger.info(f"Auto-cancelled rental #{rental.id}: rig offline {offline_minutes:.0f}min in first 30min")

        await db.commit()


async def scheduler_loop():
    """Run periodic tasks every 60 seconds."""
    loop_count = 0

    while True:
        try:
            # scan_deposits MUST complete before sweep_deposits runs
            # to avoid sweeping UTXOs before they're credited to user balance
            await scan_deposits()

            await asyncio.gather(
                expire_rentals(),
                auto_cancel_low_hashrate(),
                process_rental_reviews(),
            )

            loop_count += 1

            if loop_count % 5 == 0:
                await monitor_hashrates()

            # Sweep runs after scan in same loop — never before
            if loop_count % 10 == 0:
                await sweep_deposits()
                loop_count = 0

        except Exception as e:
            logger.error(f"Scheduler error: {e}")

        await asyncio.sleep(60)


async def monitor_hashrates():
    """
    Hashrate data is now reported by the stratum proxy via
    POST /api/v1/internal/hashrate-report every 5 minutes.
    This function is kept as a no-op so the scheduler loop is unchanged.
    """
    pass
