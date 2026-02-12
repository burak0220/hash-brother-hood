import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.platform import PlatformSetting
from app.schemas.payment import (
    BalanceResponse, DepositRequest, WithdrawRequest,
    TransactionResponse, TransactionListResponse, PlatformAddressResponse,
)
from app.services.payment import deposit, withdraw, list_transactions, verify_pending_deposit

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: User = Depends(get_current_user)):
    return {"balance": user.balance}


@router.get("/platform-address", response_model=PlatformAddressResponse)
async def get_platform_address(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == "platform_wallet")
    )
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Platform wallet address not configured")
    return {"address": setting.value}


@router.post("/deposit", response_model=TransactionResponse)
async def make_deposit(
    data: DepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        tx = await deposit(db, user, data.amount, data.tx_hash)
        return tx
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/deposit/{tx_id}/verify", response_model=TransactionResponse)
async def verify_deposit(
    tx_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-verify a pending deposit transaction on BSC."""
    try:
        tx = await verify_pending_deposit(db, tx_id)
        return tx
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/withdraw", response_model=TransactionResponse)
async def make_withdrawal(
    data: WithdrawRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        tx = await withdraw(db, user, data.amount, data.wallet_address)
        return tx
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    txs, total = await list_transactions(db, user.id, page=page, per_page=per_page, tx_type=type)
    return {
        "items": txs,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }
