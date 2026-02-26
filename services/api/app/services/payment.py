from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.user import User
from app.models.transaction import Transaction


async def deposit(db: AsyncSession, user: User, amount: Decimal, tx_hash: str) -> Transaction:
    """Submit a manual deposit with a Litecoin transaction hash for verification."""
    # Check for duplicate tx_hash
    existing = await db.execute(
        select(Transaction).where(
            Transaction.tx_hash == tx_hash,
            Transaction.type == "deposit",
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("This transaction hash has already been submitted.")

    tx = Transaction(
        user_id=user.id,
        type="deposit",
        amount=amount,
        status="pending",
        tx_hash=tx_hash,
        description=f"Manual deposit submission — pending LTC verification",
    )
    db.add(tx)
    await db.flush()
    await db.refresh(tx)
    return tx


async def verify_pending_deposit(db: AsyncSession, tx_id: int, user_id: int) -> Transaction:
    """Re-verify a pending deposit on Litecoin and credit balance if confirmed."""
    from app.services.blockchain import _rpc_call
    from app.core.config import settings

    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.user_id == user_id,
            Transaction.type == "deposit",
            Transaction.status == "pending",
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise ValueError("Pending deposit not found.")
    if not tx.tx_hash:
        raise ValueError("No transaction hash associated with this deposit.")

    try:
        tx_data = _rpc_call("getrawtransaction", [tx.tx_hash, True])
    except Exception:
        raise ValueError("Could not reach the blockchain. Please try again later.")

    if tx_data is None:
        raise ValueError("Transaction not yet confirmed on blockchain. Please wait and try again.")

    confirmations = tx_data.get("confirmations", 0)
    if confirmations < 1:
        raise ValueError("Transaction not yet confirmed on blockchain. Please wait and try again.")

    # Credit balance and mark completed
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()
    user.balance += tx.amount
    tx.status = "completed"
    tx.description = f"Deposit of {tx.amount} LTC — verified on Litecoin"

    await db.flush()
    await db.refresh(tx)
    return tx


async def withdraw(db: AsyncSession, user: User, amount: Decimal, wallet_address: str) -> Transaction:
    now = datetime.now(timezone.utc)
    if user.security_hold_until and user.security_hold_until > now:
        hold_str = user.security_hold_until.strftime("%Y-%m-%d %H:%M UTC")
        raise ValueError(
            f"Withdrawals are temporarily blocked until {hold_str} due to a recent account security change. "
            "This is a standard security measure to protect your funds."
        )

    fee = Decimal("0.0001")  # ~0.01 USD, dynamic LTC network fee
    total = amount + fee
    if user.balance < total:
        raise ValueError("Insufficient balance for this withdrawal. Please ensure you have enough funds including the network fee.")

    user.balance -= total
    tx = Transaction(
        user_id=user.id, type="withdrawal", amount=amount, fee=fee,
        status="pending", wallet_address=wallet_address,
        description=f"Withdrawal of {amount} LTC to {wallet_address}",
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
