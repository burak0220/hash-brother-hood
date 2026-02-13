from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.transaction import Transaction
from app.models.platform import PlatformSetting
from app.services.blockchain import verify_deposit as bsc_verify_deposit


async def _get_platform_address(db: AsyncSession) -> str | None:
    """Get platform wallet address from settings."""
    result = await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == "platform_wallet")
    )
    setting = result.scalar_one_or_none()
    return setting.value if setting else None


async def deposit(db: AsyncSession, user: User, amount: Decimal, tx_hash: str) -> Transaction:
    """
    Process a USDT deposit with BSC blockchain verification.

    Uses a unique constraint on tx_hash to prevent race conditions
    instead of check-then-insert pattern.
    """
    # Get platform wallet address for verification
    platform_address = await _get_platform_address(db)

    if platform_address and platform_address != "0x0000000000000000000000000000000000000000":
        # Verify on BSC
        result = await bsc_verify_deposit(tx_hash, amount, platform_address)

        if result["verified"]:
            verified_amount = Decimal(str(result["amount"]))
            user.balance += verified_amount
            tx = Transaction(
                user_id=user.id, type="deposit", amount=verified_amount,
                status="completed", tx_hash=tx_hash,
                wallet_address=result.get("from_address"),
                description=f"Deposit of {verified_amount} USDT (verified on BSC, block #{result.get('block_number')})",
            )
            db.add(tx)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                raise ValueError("This transaction hash has already been used for a deposit")
            await db.refresh(tx)
            return tx

        elif result["status"] == "pending":
            tx = Transaction(
                user_id=user.id, type="deposit", amount=amount,
                status="pending", tx_hash=tx_hash,
                description="Deposit pending BSC confirmation",
            )
            db.add(tx)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                raise ValueError("This transaction hash has already been used for a deposit")
            await db.refresh(tx)
            return tx

        else:
            raise ValueError(result.get("error", "Transaction verification failed"))
    else:
        raise ValueError("Deposits are temporarily unavailable. Platform wallet is not configured.")


async def verify_pending_deposit(db: AsyncSession, tx_id: int, user_id: int) -> Transaction:
    """
    Re-verify a pending deposit transaction on BSC.
    Called by user or admin to check if a pending deposit has been confirmed.
    """
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise ValueError("Transaction not found")
    if tx.user_id != user_id:
        raise ValueError("Transaction not found")
    if tx.type != "deposit" or tx.status != "pending":
        raise ValueError("Transaction is not a pending deposit")

    platform_address = await _get_platform_address(db)
    if not platform_address:
        raise ValueError("Platform wallet not configured")

    bsc_result = await bsc_verify_deposit(tx.tx_hash, tx.amount, platform_address)

    if bsc_result["verified"]:
        verified_amount = Decimal(str(bsc_result["amount"]))
        tx.amount = verified_amount
        tx.status = "completed"
        tx.wallet_address = bsc_result.get("from_address")
        tx.description = f"Deposit of {verified_amount} USDT (verified on BSC, block #{bsc_result.get('block_number')})"

        # Credit user balance
        user_result = await db.execute(select(User).where(User.id == tx.user_id))
        user = user_result.scalar_one()
        user.balance += verified_amount

        await db.flush()
        await db.refresh(tx)
        return tx

    elif bsc_result["status"] == "pending":
        raise ValueError("Transaction still pending confirmation on BSC")
    else:
        tx.status = "failed"
        tx.description = f"Verification failed: {bsc_result.get('error')}"
        await db.flush()
        await db.refresh(tx)
        raise ValueError(bsc_result.get("error", "Verification failed"))


async def withdraw(db: AsyncSession, user: User, amount: Decimal, wallet_address: str) -> Transaction:
    fee = Decimal("1.00")
    total = amount + fee
    if user.balance < total:
        raise ValueError("Insufficient balance")

    user.balance -= total
    tx = Transaction(
        user_id=user.id, type="withdrawal", amount=amount, fee=fee,
        status="pending", wallet_address=wallet_address,
        description=f"Withdrawal of {amount} USDT to {wallet_address}",
    )
    db.add(tx)
    await db.flush()
    await db.refresh(tx)
    return tx


async def list_transactions(
    db: AsyncSession, user_id: int, page: int = 1, per_page: int = 20,
    tx_type: str | None = None,
) -> tuple[list[Transaction], int]:
    query = select(Transaction).where(Transaction.user_id == user_id)
    if tx_type:
        query = query.where(Transaction.type == tx_type)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Transaction.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total
