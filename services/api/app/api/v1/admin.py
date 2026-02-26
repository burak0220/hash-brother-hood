import math
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from app.core.config import settings
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
from app.services.blockchain import send_ltc, get_hot_wallet_balance

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

    # Send LTC from hot wallet
    ltc_result = await send_ltc(tx.wallet_address, tx.amount)

    if ltc_result["success"]:
        tx.status = "completed"
        tx.tx_hash = ltc_result["tx_hash"]
        tx.description = f"Withdrawal of {tx.amount} LTC to {tx.wallet_address}"

        log = AdminAuditLog(
            admin_id=admin.id, action="approve_withdrawal",
            entity_type="transaction", entity_id=str(tx_id),
            details={"tx_hash": ltc_result["tx_hash"]},
        )
        db.add(log)
        await db.flush()
        return {"message": "Withdrawal approved and sent on Litecoin", "tx_hash": ltc_result["tx_hash"]}
    else:
        # LTC transfer failed - keep pending
        error_msg = ltc_result.get("error", "Unknown error")
        log = AdminAuditLog(
            admin_id=admin.id, action="approve_withdrawal_failed",
            entity_type="transaction", entity_id=str(tx_id),
            details={"error": error_msg},
        )
        db.add(log)
        await db.flush()
        raise HTTPException(
            status_code=500,
            detail=f"LTC transfer failed: {error_msg}. Withdrawal remains pending.",
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

    now = datetime.now(timezone.utc)

    # Use escrow_amount (original cost only — extensions already settled to owner)
    escrow = rental.escrow_amount or rental.total_cost
    renter_fee_pct = Decimal(str(settings.RENTER_FEE_PERCENT)) / Decimal("100")
    original_renter_fee = (escrow * renter_fee_pct).quantize(Decimal("0.01"))

    if rental.status == "active" and rental.started_at:
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
        refund_amount = escrow
        fee_refund = original_renter_fee

    total_refund = refund_amount + fee_refund

    rental.status = "cancelled"
    rental.cancelled_at = now

    # Refund renter (unused escrow + proportional fee)
    renter = (await db.execute(select(User).where(User.id == rental.renter_id))).scalar_one()
    renter.balance += total_refund
    refund_tx = Transaction(
        user_id=rental.renter_id, type="refund", amount=total_refund,
        status="completed", description=f"Admin refund for rental #{rental_id}",
    )
    db.add(refund_tx)

    # Pay owner for delivered portion (from escrow only)
    fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
    used_amount = escrow - refund_amount
    if used_amount > Decimal("0.00"):
        platform_fee = (used_amount * fee_percent).quantize(Decimal("0.01"))
        owner_earning = used_amount - platform_fee
        owner = (await db.execute(select(User).where(User.id == rental.owner_id))).scalar_one()
        owner.balance += owner_earning
        db.add(Transaction(
            user_id=rental.owner_id, type="rental_earning", amount=owner_earning,
            status="completed", description=f"Partial earning for admin-cancelled rental #{rental_id}",
        ))

    # Restore rig status
    rig = (await db.execute(select(Rig).where(Rig.id == rental.rig_id))).scalar_one_or_none()
    if rig:
        rig.status = "active"

    log = AdminAuditLog(
        admin_id=admin.id, action="cancel_rental", entity_type="rental", entity_id=str(rental_id),
        details={"refund_amount": float(total_refund)},
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
    """Get hot wallet LTC balance."""
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
            "rig_id": d.rental.rig_id if d.rental else None,
            "opened_by": d.opened_by,
            "opener_username": d.opener.username if d.opener else None,
            "reason": d.reason,
            "status": d.status,
            "resolution": d.resolution,
            "created_at": d.created_at,
        }
        for d in disputes
    ]


@router.get("/disputes/{dispute_id}")
async def get_dispute_detail(
    dispute_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dispute).options(
            selectinload(Dispute.opener),
            selectinload(Dispute.rental),
            selectinload(Dispute.messages).selectinload(DisputeMessage.sender),
        ).where(Dispute.id == dispute_id)
    )
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return {
        "id": d.id, "rental_id": d.rental_id,
        "rig_id": d.rental.rig_id if d.rental else None,
        "opened_by": d.opened_by,
        "opener_username": d.opener.username if d.opener else None,
        "reason": d.reason, "status": d.status, "resolution": d.resolution,
        "created_at": d.created_at,
        "messages": [
            {"id": m.id, "sender": m.sender.username if m.sender else "?", "sender_id": m.sender_id,
             "content": m.content, "created_at": m.created_at}
            for m in d.messages
        ],
    }


@router.post("/disputes/{dispute_id}/message")
async def admin_dispute_message(
    dispute_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    msg = DisputeMessage(dispute_id=dispute_id, sender_id=admin.id, content=data.get("content", ""))
    db.add(msg)
    await db.commit()
    return {"message": "Reply sent"}


@router.post("/disputes/{dispute_id}/resolve")
async def admin_resolve_dispute(
    dispute_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if dispute.status == "resolved":
        raise HTTPException(status_code=400, detail="Already resolved")

    action = data.get("action", "resolve")  # resolve, refund_renter, refund_owner
    resolution = data.get("resolution", "")
    refund_amount = Decimal(str(data.get("refund_amount", 0)))

    dispute.status = "resolved"
    dispute.resolution = resolution
    dispute.resolved_by = admin.id
    dispute.resolved_at = datetime.now(timezone.utc)

    # Handle refund if specified
    if action == "refund_renter" and refund_amount > 0:
        rental_result = await db.execute(select(Rental).where(Rental.id == dispute.rental_id))
        rental = rental_result.scalar_one_or_none()
        if rental:
            renter = await db.get(User, rental.renter_id)
            if renter:
                renter.balance += refund_amount
                db.add(Transaction(
                    user_id=renter.id, type="dispute_refund", amount=refund_amount,
                    status="completed", description=f"Dispute #{dispute_id} refund: {resolution}",
                ))

    db.add(AdminAuditLog(admin_id=admin.id, action="resolve_dispute",
                    entity_type="dispute", entity_id=str(dispute_id),
                    details=f"Action: {action}, Resolution: {resolution}"))

    return {"message": f"Dispute resolved: {resolution}"}


@router.get("/pending-actions")
async def get_pending_actions(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get counts of all pending admin actions."""
    from sqlalchemy import func as sqlfunc

    pending_withdrawals = (await db.execute(
        select(sqlfunc.count()).select_from(Transaction).where(Transaction.type == "withdrawal", Transaction.status == "pending")
    )).scalar() or 0

    pending_disputes = (await db.execute(
        select(sqlfunc.count()).select_from(Dispute).where(Dispute.status == "open")
    )).scalar() or 0

    pending_escrows = (await db.execute(
        select(sqlfunc.count()).select_from(Rental).where(
            Rental.status == "completed", Rental.reviewed_at.is_(None), Rental.escrow_released.is_(False)
        )
    )).scalar() or 0

    open_tickets = 0
    try:
        from app.models.support_ticket import SupportTicket
        open_tickets = (await db.execute(
            select(sqlfunc.count()).select_from(SupportTicket).where(SupportTicket.status == "open")
        )).scalar() or 0
    except Exception:
        pass

    return {
        "pending_withdrawals": pending_withdrawals,
        "pending_disputes": pending_disputes,
        "pending_escrows": pending_escrows,
        "open_tickets": open_tickets,
        "total": pending_withdrawals + pending_disputes + pending_escrows + open_tickets,
    }


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
    
    # Use escrow_amount (original cost only — extensions already settled to owner)
    escrow = rental.escrow_amount or rental.total_cost
    original_duration_hours = rental.original_duration_hours or rental.duration_hours or 0
    original_total_seconds = max(original_duration_hours * 3600, 1)
    used_seconds = max((now - rental.started_at).total_seconds(), 0)
    used_ratio = min(Decimal(str(used_seconds / original_total_seconds)), Decimal("1"))
    unused_ratio = Decimal("1") - used_ratio

    # Unused time: full refund from escrow
    unused_refund = (escrow * unused_ratio).quantize(Decimal("0.01"))

    # Used time: performance-adjusted refund (e.g. 35% refund if 65% performance)
    performance_ratio = Decimal(str(avg_performance / 100.0))
    performance_loss = Decimal("1") - performance_ratio
    used_refund = (escrow * used_ratio * performance_loss).quantize(Decimal("0.01"))

    total_refund = unused_refund + used_refund

    fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")

    # Refund renter from escrow
    renter = (await db.execute(select(User).where(User.id == rental.renter_id))).scalar_one()
    renter.balance += total_refund
    db.add(Transaction(
        user_id=renter.id, type="refund", amount=total_refund,
        status="completed",
        description=f"Cancellation approved: {avg_performance:.1f}% avg hashrate (Request #{req.id})"
    ))

    # Pay owner their performance-adjusted earned portion from escrow (they never received it yet)
    owner_earned = (escrow * used_ratio * performance_ratio).quantize(Decimal("0.01"))
    platform_fee = (owner_earned * fee_percent).quantize(Decimal("0.01"))
    owner_earning = owner_earned - platform_fee
    owner = (await db.execute(select(User).where(User.id == rental.owner_id))).scalar_one()
    if owner_earning > Decimal("0.00"):
        owner.balance += owner_earning
        db.add(Transaction(
            user_id=owner.id, type="rental_earning", amount=owner_earning,
            status="completed",
            description=f"Partial earning for cancellation-approved rental #{rental.id} ({avg_performance:.1f}% hashrate)"
        ))
    
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


# ═══════════════════════════════════════════════════════════════════════════════
# Sprint 2: Granular Admin Controls
# ═══════════════════════════════════════════════════════════════════════════════

from app.schemas.admin import AdminRPIOverride, AdminRentalReview, AdminRigCorrection


@router.post("/rigs/{rig_id}/rpi-override")
async def override_rig_rpi(
    rig_id: int,
    data: AdminRPIOverride,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually override a rig's RPI score."""
    rig = await db.get(Rig, rig_id)
    if not rig:
        raise HTTPException(status_code=404, detail="Rig not found.")

    old_rpi = float(rig.rpi_score)
    rig.rpi_score = data.rpi_score
    await db.flush()

    log = AdminAuditLog(
        admin_id=admin.id, action="rpi_override",
        entity_type="rig", entity_id=str(rig_id),
        details={"old_rpi": old_rpi, "new_rpi": float(data.rpi_score), "reason": data.reason},
    )
    db.add(log)
    await db.commit()

    return {
        "message": f"RPI updated from {old_rpi:.1f} to {float(data.rpi_score):.1f}",
        "rig_id": rig_id,
        "old_rpi": old_rpi,
        "new_rpi": float(data.rpi_score),
    }


@router.post("/rigs/{rig_id}/correct")
async def correct_rig(
    rig_id: int,
    data: AdminRigCorrection,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin correction of rig hashrate or status."""
    rig = await db.get(Rig, rig_id)
    if not rig:
        raise HTTPException(status_code=404, detail="Rig not found.")

    changes = {}
    if data.hashrate is not None:
        changes["old_hashrate"] = float(rig.hashrate)
        rig.hashrate = data.hashrate
        changes["new_hashrate"] = float(data.hashrate)
    if data.status is not None:
        changes["old_status"] = rig.status
        rig.status = data.status
        changes["new_status"] = data.status

    changes["reason"] = data.reason
    await db.flush()

    log = AdminAuditLog(
        admin_id=admin.id, action="rig_correction",
        entity_type="rig", entity_id=str(rig_id),
        details=changes,
    )
    db.add(log)
    await db.commit()

    return {"message": "Rig corrected.", "changes": changes}


@router.post("/rentals/{rental_id}/review")
async def admin_review_rental(
    rental_id: int,
    data: AdminRentalReview,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin review of a completed rental.
    Actions: approve_refund, reject_refund, adjust_refund, force_refund
    """
    from decimal import Decimal
    from app.core.config import settings

    result = await db.execute(select(Rental).where(Rental.id == rental_id))
    rental = result.scalar_one_or_none()
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found.")

    if rental.status not in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Only completed or cancelled rentals can be reviewed.")

    response_msg = ""

    if data.action == "approve_refund":
        # Approve and release escrow immediately
        rental.reviewed_by = admin.id
        from datetime import datetime, timezone
        rental.reviewed_at = datetime.now(timezone.utc)

        # Release escrow if not already released
        if not rental.escrow_released:
            escrow = rental.escrow_amount or rental.total_cost
            fee_pct = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
            perf = float(rental.performance_percent) if rental.performance_percent is not None else 100.0

            refund = Decimal("0")
            if perf < 95.0:
                missing_pct = (100.0 - perf) / 100.0
                refund = Decimal(str(round(float(escrow) * missing_pct, 2)))
                if refund < Decimal("0.01"):
                    refund = Decimal("0")

            owner_amount = escrow - refund
            platform_fee = owner_amount * fee_pct
            owner_earning = owner_amount - platform_fee

            # Pay owner
            if owner_earning > 0:
                owner = await db.get(User, rental.owner_id)
                if owner:
                    owner.balance += owner_earning
                    db.add(Transaction(
                        user_id=owner.id, type="escrow_release", amount=owner_earning,
                        status="completed",
                        description=f"Admin approved escrow for rental #{rental.id} ({perf:.1f}% delivery)"
                    ))

            # Refund renter if needed
            if refund > 0:
                rental.refund_amount = refund
                rental.refund_reason = f"Auto-refund: {perf:.1f}% hashrate delivery"
                renter = await db.get(User, rental.renter_id)
                if renter:
                    renter.balance += refund
                    db.add(Transaction(
                        user_id=renter.id, type="refund", amount=refund,
                        status="completed",
                        description=f"Refund for rental #{rental.id}: {perf:.1f}% delivery"
                    ))

            rental.escrow_released = True
            rental.escrow_released_at = datetime.now(timezone.utc)
            response_msg = f"Escrow released. Owner earned {float(owner_earning):.2f} LTC" + (f", renter refunded {float(refund):.2f} LTC" if refund > 0 else "") + "."
        else:
            response_msg = f"Escrow already released. Marked as reviewed."

    elif data.action == "reject_refund":
        # Reject refund — reverse the refund if it was already given
        if rental.refund_amount and float(rental.refund_amount) > 0:
            # Reverse: deduct from renter, add back to owner
            renter = await db.get(User, rental.renter_id)
            owner = await db.get(User, rental.owner_id)
            refund_amt = rental.refund_amount

            if renter and renter.balance >= refund_amt:
                renter.balance -= refund_amt
                fee_pct = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
                owner_portion = refund_amt * (1 - fee_pct)
                if owner:
                    owner.balance += owner_portion

                tx_renter = Transaction(
                    user_id=renter.id, type="refund_reversal", amount=refund_amt,
                    status="completed", description=f"Admin rejected refund for rental #{rental_id}",
                )
                db.add(tx_renter)
                if owner:
                    tx_owner = Transaction(
                        user_id=owner.id, type="refund_reversal", amount=owner_portion,
                        status="completed", description=f"Refund reversed for rental #{rental_id}",
                    )
                    db.add(tx_owner)

            old_amount = float(rental.refund_amount)
            rental.refund_amount = Decimal("0")
            rental.refund_reason = f"Admin rejected: {data.reason}" if data.reason else "Admin rejected refund"
            response_msg = f"Refund of {old_amount:.2f} LTC rejected and reversed."
        else:
            response_msg = "No refund to reject."

        rental.reviewed_by = admin.id
        from datetime import datetime, timezone
        rental.reviewed_at = datetime.now(timezone.utc)

    elif data.action == "adjust_refund":
        if data.refund_amount is None:
            raise HTTPException(status_code=400, detail="refund_amount required for adjust_refund.")

        old_amount = rental.refund_amount or Decimal("0")
        new_amount = data.refund_amount
        diff = new_amount - old_amount

        renter = await db.get(User, rental.renter_id)
        owner = await db.get(User, rental.owner_id)
        fee_pct = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")

        if diff > 0:
            # Increase refund — give more to renter, take from owner
            owner_deduct = diff * (1 - fee_pct)
            if renter:
                renter.balance += diff
                db.add(Transaction(
                    user_id=renter.id, type="refund_adjustment", amount=diff,
                    status="completed", description=f"Admin adjusted refund for rental #{rental_id} (+{float(diff):.2f})",
                ))
            if owner and owner.balance >= owner_deduct:
                owner.balance -= owner_deduct
                db.add(Transaction(
                    user_id=owner.id, type="refund_adjustment", amount=owner_deduct,
                    status="completed", description=f"Admin refund adjustment for rental #{rental_id}",
                ))
        elif diff < 0:
            # Decrease refund — take from renter, give back to owner
            take_back = abs(diff)
            owner_return = take_back * (1 - fee_pct)
            if renter and renter.balance >= take_back:
                renter.balance -= take_back
                db.add(Transaction(
                    user_id=renter.id, type="refund_adjustment", amount=take_back,
                    status="completed", description=f"Admin reduced refund for rental #{rental_id} (-{float(take_back):.2f})",
                ))
            if owner:
                owner.balance += owner_return
                db.add(Transaction(
                    user_id=owner.id, type="refund_adjustment", amount=owner_return,
                    status="completed", description=f"Admin refund reduction for rental #{rental_id}",
                ))

        rental.refund_amount = new_amount
        rental.refund_reason = f"Admin adjusted: {data.reason}" if data.reason else f"Admin adjusted to {float(new_amount):.2f}"
        rental.reviewed_by = admin.id
        from datetime import datetime, timezone
        rental.reviewed_at = datetime.now(timezone.utc)
        response_msg = f"Refund adjusted from {float(old_amount):.2f} to {float(new_amount):.2f} LTC."

    elif data.action == "force_refund":
        if data.refund_amount is None:
            raise HTTPException(status_code=400, detail="refund_amount required for force_refund.")

        renter = await db.get(User, rental.renter_id)
        owner = await db.get(User, rental.owner_id)
        fee_pct = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")

        refund = data.refund_amount
        owner_deduct = refund * (1 - fee_pct)

        if renter:
            renter.balance += refund
            db.add(Transaction(
                user_id=renter.id, type="admin_refund", amount=refund,
                status="completed", description=f"Admin forced refund for rental #{rental_id}",
            ))
        if owner and owner.balance >= owner_deduct:
            owner.balance -= owner_deduct
            db.add(Transaction(
                user_id=owner.id, type="admin_refund", amount=owner_deduct,
                status="completed", description=f"Admin forced refund deduction for rental #{rental_id}",
            ))

        rental.refund_amount = (rental.refund_amount or Decimal("0")) + refund
        rental.refund_reason = f"Admin forced: {data.reason}" if data.reason else "Admin forced refund"
        rental.reviewed_by = admin.id
        from datetime import datetime, timezone
        rental.reviewed_at = datetime.now(timezone.utc)
        response_msg = f"Forced refund of {float(refund):.2f} LTC applied."

    log = AdminAuditLog(
        admin_id=admin.id, action=f"rental_review_{data.action}",
        entity_type="rental", entity_id=str(rental_id),
        details={"action": data.action, "refund_amount": float(data.refund_amount) if data.refund_amount else None, "reason": data.reason},
    )
    db.add(log)
    await db.commit()

    return {"message": response_msg, "rental_id": rental_id}
