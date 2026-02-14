from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.user import User
from app.models.rental import Rental
from app.models.dispute import Dispute, DisputeMessage

router = APIRouter(prefix="/disputes", tags=["Disputes"])


class DisputeCreate(BaseModel):
    rental_id: int
    reason: str = Field(min_length=10, max_length=2000)


class DisputeMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class DisputeResolve(BaseModel):
    resolution: str = Field(min_length=1, max_length=2000)
    action: str = Field(pattern="^(refund|partial_refund|reject)$")
    refund_percent: int = Field(default=100, ge=0, le=100)


def _dispute_to_response(d: Dispute) -> dict:
    data = {
        "id": d.id,
        "rental_id": d.rental_id,
        "opened_by": d.opened_by,
        "opener_username": d.opener.username if d.opener else None,
        "reason": d.reason,
        "status": d.status,
        "resolution": d.resolution,
        "resolved_at": d.resolved_at,
        "created_at": d.created_at,
        "messages": [],
    }
    if d.messages:
        data["messages"] = [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_username": m.sender.username if m.sender else None,
                "content": m.content,
                "created_at": m.created_at,
            }
            for m in d.messages
        ]
    return data


@router.post("", status_code=201)
async def open_dispute(
    data: DisputeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Open a dispute for a rental."""
    rental = await db.get(Rental, data.rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The associated rental could not be found.")
    if rental.renter_id != user.id and rental.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to access this dispute.")
    if rental.status not in ("active", "completed"):
        raise HTTPException(status_code=400, detail="Disputes can only be filed for active or completed rentals.")

    # Check no open dispute exists
    existing = await db.execute(
        select(Dispute).where(Dispute.rental_id == data.rental_id, Dispute.status.in_(["open", "under_review"]))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="There is already an active dispute for this rental. Please wait for it to be resolved.")

    dispute = Dispute(rental_id=data.rental_id, opened_by=user.id, reason=data.reason)
    db.add(dispute)
    await db.flush()
    await db.refresh(dispute)
    return {"id": dispute.id, "status": dispute.status, "message": "Dispute opened successfully"}


@router.get("")
async def list_my_disputes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List disputes related to the current user."""
    result = await db.execute(
        select(Dispute)
        .options(selectinload(Dispute.opener), selectinload(Dispute.messages).selectinload(DisputeMessage.sender))
        .join(Rental)
        .where((Rental.renter_id == user.id) | (Rental.owner_id == user.id))
        .order_by(Dispute.created_at.desc())
    )
    disputes = result.scalars().all()
    return [_dispute_to_response(d) for d in disputes]


@router.get("/{dispute_id}")
async def get_dispute(
    dispute_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dispute details."""
    result = await db.execute(
        select(Dispute)
        .options(selectinload(Dispute.opener), selectinload(Dispute.messages).selectinload(DisputeMessage.sender), selectinload(Dispute.rental))
        .where(Dispute.id == dispute_id)
    )
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="The requested dispute could not be found.")

    rental = dispute.rental
    if rental.renter_id != user.id and rental.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to access this dispute.")

    return _dispute_to_response(dispute)


@router.post("/{dispute_id}/message")
async def add_message(
    dispute_id: int,
    data: DisputeMessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a message to a dispute."""
    result = await db.execute(
        select(Dispute).options(selectinload(Dispute.rental)).where(Dispute.id == dispute_id)
    )
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="The requested dispute could not be found.")

    rental = dispute.rental
    if rental.renter_id != user.id and rental.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to access this dispute.")
    if dispute.status in ("resolved", "rejected"):
        raise HTTPException(status_code=400, detail="This dispute has been closed and no longer accepts new messages.")

    msg = DisputeMessage(dispute_id=dispute_id, sender_id=user.id, content=data.content)
    db.add(msg)
    await db.flush()
    return {"message": "Message added"}


@router.post("/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: int,
    data: DisputeResolve,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: resolve a dispute."""
    from decimal import Decimal
    from app.models.user import User as UserModel
    from app.models.transaction import Transaction
    from app.core.config import settings

    result = await db.execute(
        select(Dispute).options(selectinload(Dispute.rental)).where(Dispute.id == dispute_id)
    )
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="The requested dispute could not be found.")
    if dispute.status in ("resolved", "rejected"):
        raise HTTPException(status_code=400, detail="This dispute has already been resolved and cannot be modified.")

    rental = dispute.rental
    now = datetime.now(timezone.utc)

    if data.action == "reject":
        dispute.status = "rejected"
        dispute.resolution = data.resolution
        dispute.resolved_by = admin.id
        dispute.resolved_at = now
    else:
        # refund or partial_refund
        refund_ratio = Decimal(str(data.refund_percent)) / Decimal("100")
        refund_amount = (rental.total_cost * refund_ratio).quantize(Decimal("0.01"))

        # Refund renter (full refund amount)
        renter = await db.execute(select(UserModel).where(UserModel.id == rental.renter_id))
        renter = renter.scalar_one()
        renter.balance += refund_amount

        tx = Transaction(
            user_id=renter.id, type="refund", amount=refund_amount,
            status="completed", description=f"Dispute #{dispute.id} refund ({data.refund_percent}%)",
        )
        db.add(tx)

        # Deduct from owner (same amount - money must balance!)
        # Note: Owner originally received (total_cost - platform_fee), but in a dispute
        # the owner bears the full refund cost. This is fair because the dispute
        # was likely due to owner's rig issues.
        owner = await db.execute(select(UserModel).where(UserModel.id == rental.owner_id))
        owner = owner.scalar_one()

        # Check if owner has sufficient balance for refund
        if owner.balance < refund_amount:
            raise HTTPException(
                status_code=400,
                detail="Unable to process the dispute refund. The rig owner's balance is insufficient. Please contact support."
            )

        owner.balance -= refund_amount

        tx_owner = Transaction(
            user_id=owner.id, type="refund", amount=refund_amount,
            status="completed", description=f"Dispute #{dispute.id} deduction ({data.refund_percent}%)",
        )
        db.add(tx_owner)

        dispute.status = "resolved"
        dispute.resolution = data.resolution
        dispute.resolved_by = admin.id
        dispute.resolved_at = now

    await db.flush()
    return {"message": f"Dispute {dispute.status}", "status": dispute.status}
