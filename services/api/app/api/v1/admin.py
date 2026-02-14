import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.models.rig import Rig
from app.models.rental import Rental
from app.models.transaction import Transaction
from app.models.algorithm import Algorithm
from app.models.notification import Notification
from app.models.platform import PlatformSetting, AdminAuditLog
from app.models.dispute import Dispute, DisputeMessage
from app.schemas.user import UserResponse
from app.schemas.admin import (
    AdminUserUpdate, AdminBalanceAdjust, AdminSendNotification,
    PlatformSettingUpdate, PlatformSettingResponse,
    AdminStatsResponse, AuditLogResponse,
)
from app.schemas.payment import TransactionResponse
from app.schemas.algorithm import AlgorithmResponse
from app.services.blockchain import send_usdt, get_hot_wallet_balance

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    rigs_count = (await db.execute(select(func.count(Rig.id)))).scalar() or 0
    rentals_count = (await db.execute(select(func.count(Rental.id)))).scalar() or 0
    active_rentals = (await db.execute(
        select(func.count(Rental.id)).where(Rental.status == "active")
    )).scalar() or 0
    revenue = (await db.execute(
        select(func.coalesce(func.sum(Rental.total_cost), 0)).where(Rental.status.in_(["active", "completed"]))
    )).scalar() or 0
    pending_withdrawals = (await db.execute(
        select(func.count(Transaction.id)).where(Transaction.type == "withdrawal", Transaction.status == "pending")
    )).scalar() or 0

    return {
        "total_users": users_count,
        "total_rigs": rigs_count,
        "total_rentals": rentals_count,
        "total_revenue": float(revenue),
        "active_rentals": active_rentals,
        "pending_withdrawals": pending_withdrawals,
    }


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    return list(result.scalars().all())


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    log = AdminAuditLog(
        admin_id=admin.id, action="update_user",
        entity_type="user", entity_id=str(user_id),
        details=update_data,
    )
    db.add(log)
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/withdrawals", response_model=list[TransactionResponse])
async def list_pending_withdrawals(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction)
        .where(Transaction.type == "withdrawal", Transaction.status == "pending")
        .order_by(Transaction.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/withdrawals/{tx_id}/approve")
async def approve_withdrawal(
    tx_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx or tx.type != "withdrawal" or tx.status != "pending":
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    # Auto-send USDT on BSC
    bsc_result = await send_usdt(tx.wallet_address, tx.amount)

    if bsc_result["success"]:
        tx.status = "completed"
        tx.tx_hash = bsc_result["tx_hash"]
        tx.description = f"Withdrawal of {tx.amount} USDT to {tx.wallet_address} (sent on BSC)"

        log = AdminAuditLog(
            admin_id=admin.id, action="approve_withdrawal",
            entity_type="transaction", entity_id=str(tx_id),
            details={"tx_hash": bsc_result["tx_hash"]},
        )
        db.add(log)
        await db.flush()
        return {"message": "Withdrawal approved and sent on BSC", "tx_hash": bsc_result["tx_hash"]}
    else:
        # BSC transfer failed - mark as processing error but keep pending
        error_msg = bsc_result.get("error", "Unknown error")
        log = AdminAuditLog(
            admin_id=admin.id, action="approve_withdrawal_failed",
            entity_type="transaction", entity_id=str(tx_id),
            details={"error": error_msg},
        )
        db.add(log)
        await db.flush()
        raise HTTPException(
            status_code=500,
            detail=f"BSC transfer failed: {error_msg}. Withdrawal remains pending.",
        )


@router.post("/withdrawals/{tx_id}/reject")
async def reject_withdrawal(
    tx_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx or tx.type != "withdrawal" or tx.status != "pending":
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    tx.status = "cancelled"

    # Refund balance
    user_result = await db.execute(select(User).where(User.id == tx.user_id))
    user = user_result.scalar_one()
    user.balance += tx.amount + tx.fee

    log = AdminAuditLog(
        admin_id=admin.id, action="reject_withdrawal",
        entity_type="transaction", entity_id=str(tx_id),
    )
    db.add(log)
    await db.flush()
    return {"message": "Withdrawal rejected, funds refunded"}


## ========== RIG MANAGEMENT ==========

@router.get("/rigs")
async def list_all_rigs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(Rig.id)))).scalar() or 0
    result = await db.execute(
        select(Rig).options(selectinload(Rig.algorithm), selectinload(Rig.owner))
        .order_by(Rig.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    rigs = result.scalars().all()
    return {
        "items": [
            {
                "id": r.id, "name": r.name, "status": r.status,
                "hashrate": float(r.hashrate), "price_per_hour": float(r.price_per_hour),
                "is_featured": r.is_featured,
                "owner_username": r.owner.username if r.owner else None,
                "owner_id": r.owner_id,
                "algorithm_name": r.algorithm.display_name if r.algorithm else None,
                "total_rentals": r.total_rentals,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rigs
        ],
        "total": total,
        "page": page,
        "pages": math.ceil(total / per_page),
    }


@router.delete("/rigs/{rig_id}")
async def delete_rig(
    rig_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rig).where(Rig.id == rig_id))
    rig = result.scalar_one_or_none()
    if not rig:
        raise HTTPException(status_code=404, detail="Rig not found")
    # Don't delete if actively rented
    active = (await db.execute(
        select(func.count(Rental.id)).where(Rental.rig_id == rig_id, Rental.status == "active")
    )).scalar()
    if active:
        raise HTTPException(status_code=400, detail="Cannot delete rig with active rentals")
    await db.delete(rig)
    log = AdminAuditLog(admin_id=admin.id, action="delete_rig", entity_type="rig", entity_id=str(rig_id))
    db.add(log)
    await db.flush()
    return {"message": "Rig deleted"}


@router.put("/rigs/{rig_id}/feature")
async def toggle_feature_rig(
    rig_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rig).where(Rig.id == rig_id))
    rig = result.scalar_one_or_none()
    if not rig:
        raise HTTPException(status_code=404, detail="Rig not found")
    rig.is_featured = not rig.is_featured
    log = AdminAuditLog(
        admin_id=admin.id, action="toggle_feature_rig", entity_type="rig", entity_id=str(rig_id),
        details={"is_featured": rig.is_featured},
    )
    db.add(log)
    await db.flush()
    return {"message": f"Rig {'featured' if rig.is_featured else 'unfeatured'}", "is_featured": rig.is_featured}


## ========== ALGORITHM MANAGEMENT ==========

@router.get("/algorithms", response_model=list[AlgorithmResponse])
async def list_all_algorithms(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Algorithm).order_by(Algorithm.name))
    return list(result.scalars().all())


@router.put("/algorithms/{algo_id}", response_model=AlgorithmResponse)
async def update_algorithm(
    algo_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Algorithm).where(Algorithm.id == algo_id))
    algo = result.scalar_one_or_none()
    if not algo:
        raise HTTPException(status_code=404, detail="Algorithm not found")
    if "display_name" in data:
        algo.display_name = data["display_name"]
    if "unit" in data:
        algo.unit = data["unit"]
    if "is_active" in data:
        algo.is_active = data["is_active"]
    log = AdminAuditLog(admin_id=admin.id, action="update_algorithm", entity_type="algorithm", entity_id=str(algo_id), details=data)
    db.add(log)
    await db.flush()
    await db.refresh(algo)
    return algo


@router.delete("/algorithms/{algo_id}")
async def delete_algorithm(
    algo_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Algorithm).where(Algorithm.id == algo_id))
    algo = result.scalar_one_or_none()
    if not algo:
        raise HTTPException(status_code=404, detail="Algorithm not found")
    # Check if any rigs use this algorithm
    rig_count = (await db.execute(select(func.count(Rig.id)).where(Rig.algorithm_id == algo_id))).scalar()
    if rig_count:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {rig_count} rigs use this algorithm. Deactivate instead.")
    await db.delete(algo)
    log = AdminAuditLog(admin_id=admin.id, action="delete_algorithm", entity_type="algorithm", entity_id=str(algo_id))
    db.add(log)
    await db.flush()
    return {"message": "Algorithm deleted"}


## ========== RENTAL MANAGEMENT ==========

@router.get("/rentals")
async def list_all_rentals(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Rental).order_by(Rental.created_at.desc())
    count_query = select(func.count(Rental.id))
    if status:
        query = query.where(Rental.status == status)
        count_query = count_query.where(Rental.status == status)
    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.offset((page - 1) * per_page).limit(per_page))
    rentals = result.scalars().all()
    return {
        "items": [
            {
                "id": r.id, "rig_id": r.rig_id, "renter_id": r.renter_id,
                "status": r.status, "duration_hours": r.duration_hours,
                "total_cost": float(r.total_cost),
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "ends_at": r.ends_at.isoformat() if r.ends_at else None,
            }
            for r in rentals
        ],
        "total": total,
        "page": page,
        "pages": math.ceil(total / per_page),
    }


@router.post("/rentals/{rental_id}/cancel")
async def admin_cancel_rental(
    rental_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rental).where(Rental.id == rental_id))
    rental = result.scalar_one_or_none()
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    if rental.status not in ("active", "pending"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel rental with status: {rental.status}")

    rental.status = "cancelled"
    # Refund renter
    renter = (await db.execute(select(User).where(User.id == rental.renter_id))).scalar_one()
    renter.balance += rental.total_cost
    # Create refund transaction
    refund_tx = Transaction(
        user_id=rental.renter_id, type="refund", amount=rental.total_cost,
        status="completed", description=f"Admin refund for rental #{rental_id}",
    )
    db.add(refund_tx)
    log = AdminAuditLog(
        admin_id=admin.id, action="cancel_rental", entity_type="rental", entity_id=str(rental_id),
        details={"refund_amount": float(rental.total_cost)},
    )
    db.add(log)
    await db.flush()
    return {"message": "Rental cancelled and refunded"}


## ========== USER BALANCE ADJUSTMENT ==========

@router.post("/users/{user_id}/adjust-balance")
async def adjust_user_balance(
    user_id: int,
    data: AdminBalanceAdjust,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_balance = user.balance + data.amount
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="Balance cannot go below zero")

    user.balance = new_balance
    tx_type = "deposit" if data.amount > 0 else "fee"
    tx = Transaction(
        user_id=user_id, type=tx_type, amount=abs(data.amount),
        status="completed", description=f"Admin adjustment: {data.reason}",
    )
    db.add(tx)
    log = AdminAuditLog(
        admin_id=admin.id, action="adjust_balance", entity_type="user", entity_id=str(user_id),
        details={"amount": data.amount, "reason": data.reason, "new_balance": float(new_balance)},
    )
    db.add(log)
    await db.flush()
    return {"message": "Balance adjusted", "new_balance": float(new_balance)}


## ========== NOTIFICATIONS ==========

@router.post("/notifications/send")
async def send_notification(
    data: AdminSendNotification,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if data.user_id:
        # Single user
        user = (await db.execute(select(User).where(User.id == data.user_id))).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        notif = Notification(
            user_id=data.user_id, type="admin", title=data.title,
            message=data.message, link=data.link,
        )
        db.add(notif)
        count = 1
    else:
        # Broadcast to all active users
        users_result = await db.execute(select(User.id).where(User.is_active == True))
        user_ids = [uid for (uid,) in users_result.all()]
        for uid in user_ids:
            notif = Notification(
                user_id=uid, type="admin", title=data.title,
                message=data.message, link=data.link,
            )
            db.add(notif)
        count = len(user_ids)

    log = AdminAuditLog(
        admin_id=admin.id, action="send_notification", entity_type="notification",
        details={"user_id": data.user_id, "title": data.title, "count": count},
    )
    db.add(log)
    await db.flush()
    return {"message": f"Notification sent to {count} user(s)"}


## ========== ALL TRANSACTIONS ==========

@router.get("/transactions")
async def list_all_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Transaction).order_by(Transaction.created_at.desc())
    count_query = select(func.count(Transaction.id))
    if type:
        query = query.where(Transaction.type == type)
        count_query = count_query.where(Transaction.type == type)
    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.offset((page - 1) * per_page).limit(per_page))
    return {
        "items": [TransactionResponse.model_validate(t) for t in result.scalars().all()],
        "total": total,
        "page": page,
        "pages": math.ceil(total / per_page),
    }


## ========== AUDIT LOGS ==========

@router.get("/audit-logs")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(AdminAuditLog.id)))).scalar() or 0
    result = await db.execute(
        select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    return {
        "items": [AuditLogResponse.model_validate(l) for l in result.scalars().all()],
        "total": total,
        "page": page,
        "pages": math.ceil(total / per_page),
    }


## ========== HOT WALLET ==========

@router.get("/wallet-balance")
async def admin_wallet_balance(admin: User = Depends(require_admin)):
    """Get hot wallet USDT and BNB balances on BSC."""
    try:
        balances = await get_hot_wallet_balance()
        return balances
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch wallet balance: {str(e)}")


## ========== DISPUTES ==========

@router.get("/disputes")
async def list_all_disputes(
    status: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Dispute).options(
        selectinload(Dispute.opener),
        selectinload(Dispute.rental),
    ).order_by(Dispute.created_at.desc())
    if status:
        query = query.where(Dispute.status == status)
    result = await db.execute(query)
    disputes = result.scalars().all()
    return [
        {
            "id": d.id,
            "rental_id": d.rental_id,
            "opened_by": d.opened_by,
            "opener_username": d.opener.username if d.opener else None,
            "reason": d.reason,
            "status": d.status,
            "resolution": d.resolution,
            "created_at": d.created_at,
        }
        for d in disputes
    ]


## ========== SETTINGS ==========

@router.get("/settings", response_model=list[PlatformSettingResponse])
async def get_settings(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlatformSetting).order_by(PlatformSetting.key))
    return list(result.scalars().all())


@router.put("/settings/{key}", response_model=PlatformSettingResponse)
async def update_setting(
    key: str,
    data: PlatformSettingUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    setting.value = data.value

    log = AdminAuditLog(
        admin_id=admin.id, action="update_setting",
        entity_type="setting", entity_id=key,
        details={"value": data.value},
    )
    db.add(log)
    await db.flush()
    await db.refresh(setting)
    return setting


# ===== CANCELLATION REQUESTS =====

@router.get("/cancellation-requests")
async def list_cancellation_requests(
    status: str | None = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all cancellation requests (optionally filtered by status)."""
    from app.models.cancellation_request import CancellationRequest
    
    query = select(CancellationRequest).options(
        selectinload(CancellationRequest.rental),
        selectinload(CancellationRequest.requester),
        selectinload(CancellationRequest.reviewer)
    ).order_by(CancellationRequest.created_at.desc())
    
    if status:
        query = query.where(CancellationRequest.status == status)
    
    result = await db.execute(query)
    requests = result.scalars().all()
    
    return [
        {
            "id": req.id,
            "rental_id": req.rental_id,
            "requester": req.requester.username if req.requester else None,
            "reason": req.reason,
            "description": req.description,
            "status": req.status,
            "admin_notes": req.admin_notes,
            "reviewed_by": req.reviewer.username if req.reviewer else None,
            "reviewed_at": req.reviewed_at,
            "created_at": req.created_at,
        }
        for req in requests
    ]


@router.post("/cancellation-requests/{request_id}/approve")
async def approve_cancellation(
    request_id: int,
    admin_notes: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Approve cancellation request and process refund based on hashrate performance.
    
    Refund calculation:
    - Used time: Paid proportionally to actual hashrate (e.g., 65% performance = 65% payment)
    - Unused time: Full refund
    - Platform fee: Deducted from owner (no refund)
    """
    from app.models.cancellation_request import CancellationRequest
    from app.services.hashrate import get_hashrate_stats
    from app.services.rental import cancel_rental
    from datetime import datetime, timezone
    from decimal import Decimal
    from app.core.config import settings
    
    result = await db.execute(
        select(CancellationRequest)
        .options(selectinload(CancellationRequest.rental))
        .where(CancellationRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req.status}")
    
    rental = req.rental
    if rental.status != "active":
        raise HTTPException(status_code=400, detail="Rental is not active")
    
    now = datetime.now(timezone.utc)
    
    # Get hashrate stats
    stats = await get_hashrate_stats(db, rental.id, hours=24)
    avg_performance = stats.get("avg_percentage") or 100.0  # Default to 100% if no data
    
    # Calculate refund
    total_seconds = max((rental.ends_at - rental.started_at).total_seconds(), 1)
    used_seconds = max((now - rental.started_at).total_seconds(), 0)
    used_ratio = min(Decimal(str(used_seconds / total_seconds)), Decimal("1"))
    unused_ratio = Decimal("1") - used_ratio
    
    # Unused time: Full refund
    unused_refund = (rental.total_cost * unused_ratio).quantize(Decimal("0.01"))
    
    # Used time: Refund based on performance loss
    performance_ratio = Decimal(str(avg_performance / 100.0))  # e.g., 0.65
    performance_loss = Decimal("1") - performance_ratio  # e.g., 0.35
    used_refund = (rental.total_cost * used_ratio * performance_loss).quantize(Decimal("0.01"))
    
    total_refund = unused_refund + used_refund
    
    # Owner deduction (includes platform fee loss)
    fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
    owner_deduct = total_refund  # Owner loses full refund amount (including platform fee)
    
    # Process refund
    renter = await db.execute(select(User).where(User.id == rental.renter_id))
    renter = renter.scalar_one()
    renter.balance += total_refund
    
    tx_renter = Transaction(
        user_id=renter.id, type="refund", amount=total_refund,
        status="completed",
        description=f"Cancellation approved: {avg_performance:.1f}% avg hashrate (Request #{req.id})"
    )
    db.add(tx_renter)
    
    # Deduct from owner
    owner = await db.execute(select(User).where(User.id == rental.owner_id))
    owner = owner.scalar_one()
    
    if owner.balance < owner_deduct:
        raise HTTPException(
            status_code=400,
            detail=f"Owner has insufficient balance (has {float(owner.balance)}, needs {float(owner_deduct)})"
        )
    
    owner.balance -= owner_deduct
    
    tx_owner = Transaction(
        user_id=owner.id, type="refund", amount=owner_deduct,
        status="completed",
        description=f"Cancellation deduction: {avg_performance:.1f}% avg hashrate (Request #{req.id})"
    )
    db.add(tx_owner)
    
    # Update rental status
    rental.status = "cancelled"
    rental.cancelled_at = now
    
    # Restore rig
    from app.models.rig import Rig
    rig = await db.execute(select(Rig).where(Rig.id == rental.rig_id))
    rig = rig.scalar_one()
    rig.status = "active"
    
    # Update request
    req.status = "approved"
    req.reviewed_by = admin.id
    req.reviewed_at = now
    req.admin_notes = admin_notes
    
    # Audit log
    log = AdminAuditLog(
        admin_id=admin.id, action="approve_cancellation",
        entity_type="cancellation_request", entity_id=str(request_id),
        details={
            "rental_id": rental.id,
            "avg_hashrate_percent": float(avg_performance),
            "total_refund": float(total_refund),
            "unused_refund": float(unused_refund),
            "used_refund": float(used_refund),
        }
    )
    db.add(log)
    
    await db.flush()
    
    return {
        "message": "Cancellation approved and refund processed",
        "refund_details": {
            "total_refund": float(total_refund),
            "unused_refund": float(unused_refund),
            "used_refund": float(used_refund),
            "avg_hashrate_percent": float(avg_performance),
        }
    }


@router.post("/cancellation-requests/{request_id}/reject")
async def reject_cancellation(
    request_id: int,
    admin_notes: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject cancellation request."""
    from app.models.cancellation_request import CancellationRequest
    from datetime import datetime, timezone
    
    result = await db.execute(
        select(CancellationRequest).where(CancellationRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req.status}")
    
    req.status = "rejected"
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.admin_notes = admin_notes
    
    log = AdminAuditLog(
        admin_id=admin.id, action="reject_cancellation",
        entity_type="cancellation_request", entity_id=str(request_id),
    )
    db.add(log)
    
    await db.flush()
    
    return {"message": "Cancellation request rejected"}
