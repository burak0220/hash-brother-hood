import math

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.rental import Rental
from app.models.rental_message import RentalMessage
from app.schemas.rental import RentalCreate, RentalPoolUpdate, RentalExtend, RentalResponse, RentalListResponse
from app.services.rental import create_rental, get_rental, cancel_rental, extend_rental, list_user_rentals, rental_to_response

router = APIRouter(prefix="/rentals", tags=["Rentals"])


@router.post("", response_model=RentalResponse, status_code=201)
async def create(
    data: RentalCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        rental = await create_rental(
            db, user, data.rig_id, data.duration_hours,
            data.pool_url, data.pool_user, data.pool_password,
            data.pool2_url, data.pool2_user, data.pool2_password,
            data.pool3_url, data.pool3_user, data.pool3_password,
            data.pool4_url, data.pool4_user, data.pool4_password,
            data.pool5_url, data.pool5_user, data.pool5_password,
        )
        full = await get_rental(db, rental.id)
        await db.commit()
        return rental_to_response(full)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class MassRentRequest(BaseModel):
    rig_ids: list[int]
    duration_hours: int
    pool_url: str
    pool_user: str
    pool_password: str = "x"
    pool2_url: str | None = None
    pool2_user: str | None = None
    pool2_password: str | None = None
    pool3_url: str | None = None
    pool3_user: str | None = None
    pool3_password: str | None = None
    pool4_url: str | None = None
    pool4_user: str | None = None
    pool4_password: str | None = None
    pool5_url: str | None = None
    pool5_user: str | None = None
    pool5_password: str | None = None


@router.post("/mass-rent", status_code=201)
async def mass_rent(
    data: MassRentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rent multiple rigs at once with the same pool configuration."""
    if len(data.rig_ids) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 rigs per mass rent.")
    if len(set(data.rig_ids)) != len(data.rig_ids):
        raise HTTPException(status_code=400, detail="Duplicate rig IDs not allowed.")

    results = []
    errors = []
    for rig_id in data.rig_ids:
        try:
            rental = await create_rental(
                db, user, rig_id, data.duration_hours,
                data.pool_url, data.pool_user, data.pool_password,
                data.pool2_url, data.pool2_user, data.pool2_password,
                data.pool3_url, data.pool3_user, data.pool3_password,
                data.pool4_url, data.pool4_user, data.pool4_password,
                data.pool5_url, data.pool5_user, data.pool5_password,
            )
            full = await get_rental(db, rental.id)
            results.append({"rig_id": rig_id, "rental_id": rental.id, "status": "success"})
        except (ValueError, Exception) as e:
            errors.append({"rig_id": rig_id, "error": str(e)})

    await db.commit()
    return {
        "message": f"Mass rent: {len(results)} successful, {len(errors)} failed.",
        "successful": results,
        "failed": errors,
    }


@router.get("", response_model=RentalListResponse)
async def list_rentals(
    role: str = Query("renter", pattern="^(renter|owner)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rentals, total = await list_user_rentals(db, user.id, role=role, page=page, per_page=per_page)
    return {
        "items": [rental_to_response(r) for r in rentals],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.get("/conversations")
async def get_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return rentals that have at least one message, with last message preview and unread count."""
    from sqlalchemy.orm import selectinload

    # Subquery: last message timestamp per rental
    last_msg_sq = (
        select(
            RentalMessage.rental_id,
            func.max(RentalMessage.created_at).label("last_at"),
        )
        .group_by(RentalMessage.rental_id)
        .subquery()
    )

    # Rentals where user is renter OR owner AND have messages
    from app.models.rig import Rig
    result = await db.execute(
        select(Rental)
        .join(last_msg_sq, Rental.id == last_msg_sq.c.rental_id)
        .options(selectinload(Rental.renter), selectinload(Rental.owner), selectinload(Rental.rig))
        .where(or_(Rental.renter_id == user.id, Rental.owner_id == user.id))
        .order_by(last_msg_sq.c.last_at.desc())
    )
    rentals = result.scalars().all()

    rows = []
    for r in rentals:
        # Get last message
        last_msg_res = await db.execute(
            select(RentalMessage)
            .where(RentalMessage.rental_id == r.id)
            .order_by(RentalMessage.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_res.scalar_one_or_none()

        # Unread count (messages from the other party not yet read)
        unread_res = await db.execute(
            select(func.count(RentalMessage.id))
            .where(
                RentalMessage.rental_id == r.id,
                RentalMessage.sender_id != user.id,
                RentalMessage.is_read == False,
            )
        )
        unread = unread_res.scalar_one()

        other = r.owner if r.renter_id == user.id else r.renter
        rows.append({
            "rental_id": r.id,
            "rig_name": (r.rig.name if r.rig else None) or f"Rig #{r.rig_id}",
            "status": r.status,
            "other_username": other.username if other else None,
            "other_id": other.id if other else None,
            "role": "renter" if r.renter_id == user.id else "owner",
            "last_message": last_msg.content[:100] if last_msg else None,
            "last_message_at": last_msg.created_at if last_msg else None,
            "unread_count": unread,
        })

    return rows


@router.get("/owner-stats/me")
async def get_owner_stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Owner dashboard stats: total earnings, active rentals, avg RPI."""
    from app.models.rental import Rental
    from app.models.rig import Rig
    from app.models.transaction import Transaction
    from sqlalchemy import func

    earnings = (await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user.id,
            Transaction.type.in_(["escrow_release", "rental_earning"]),
            Transaction.status == "completed",
        )
    )).scalar() or 0

    active = (await db.execute(
        select(func.count(Rental.id)).where(Rental.owner_id == user.id, Rental.status == "active")
    )).scalar() or 0

    total = (await db.execute(
        select(func.count(Rental.id)).where(Rental.owner_id == user.id)
    )).scalar() or 0

    rig_count = (await db.execute(
        select(func.count(Rig.id)).where(Rig.owner_id == user.id)
    )).scalar() or 0

    avg_rpi = (await db.execute(
        select(func.avg(Rig.rpi_score)).where(Rig.owner_id == user.id)
    )).scalar() or 100

    return {
        "total_earnings": float(earnings),
        "active_rentals": active,
        "total_rentals": total,
        "rig_count": rig_count,
        "avg_rpi": round(float(avg_rpi), 1),
    }


@router.get("/{rental_id}", response_model=RentalResponse)
async def get_rental_detail(
    rental_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")
    if rental.renter_id != user.id and rental.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to access this rental.")
    return rental_to_response(rental)


@router.post("/{rental_id}/cancel")
async def cancel(
    rental_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a rental with time-proportional refund."""
    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")
    if rental.renter_id != user.id and rental.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to cancel this rental.")
    try:
        updated = await cancel_rental(db, rental, user)
        await db.commit()
        full = await get_rental(db, updated.id)
        return rental_to_response(full)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{rental_id}/pool")
async def update_pool_config(
    rental_id: int,
    data: RentalPoolUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update pool configuration for an active rental. Only the renter can change pool settings."""
    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")
    if rental.renter_id != user.id:
        raise HTTPException(status_code=403, detail="Only the renter can update pool configuration.")
    if rental.status != "active":
        raise HTTPException(status_code=400, detail="Pool configuration can only be updated for active rentals.")

    rental.pool_url = data.pool_url
    rental.pool_user = data.pool_user
    rental.pool_password = data.pool_password
    rental.pool2_url = data.pool2_url
    rental.pool2_user = data.pool2_user
    rental.pool2_password = data.pool2_password
    rental.pool3_url = data.pool3_url
    rental.pool3_user = data.pool3_user
    rental.pool3_password = data.pool3_password
    rental.pool4_url = data.pool4_url
    rental.pool4_user = data.pool4_user
    rental.pool4_password = data.pool4_password
    rental.pool5_url = data.pool5_url
    rental.pool5_user = data.pool5_user
    rental.pool5_password = data.pool5_password

    await db.commit()
    await db.refresh(rental)
    full = await get_rental(db, rental_id)
    return {"message": "Pool configuration updated successfully.", "rental": rental_to_response(full)}


@router.post("/{rental_id}/extend")
async def extend(
    rental_id: int,
    data: RentalExtend,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extend an active rental's duration. Only the renter can extend."""
    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")
    try:
        updated = await extend_rental(db, rental, user, data.hours)
        await db.commit()
        full = await get_rental(db, updated.id)
        return {"message": f"Rental extended by {data.hours} hours.", "rental": rental_to_response(full)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{rental_id}/messages")
async def get_rental_messages(
    rental_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get chat messages for a rental (renter and owner only)."""
    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")
    if user.id not in (rental.renter_id, rental.owner_id) and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to access this rental.")

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(RentalMessage)
        .options(selectinload(RentalMessage.sender))
        .where(RentalMessage.rental_id == rental_id)
        .order_by(RentalMessage.created_at.asc())
    )
    messages = result.scalars().all()

    # Mark messages from other party as read
    for msg in messages:
        if msg.sender_id != user.id and not msg.is_read:
            msg.is_read = True
    await db.commit()

    return [
        {
            "id": m.id,
            "rental_id": m.rental_id,
            "sender_id": m.sender_id,
            "sender_username": m.sender.username if m.sender else None,
            "content": m.content,
            "is_read": m.is_read,
            "created_at": m.created_at,
        }
        for m in messages
    ]


class RentalMessageCreate(BaseModel):
    content: str


@router.post("/{rental_id}/messages")
async def send_rental_message(
    rental_id: int,
    data: RentalMessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a chat message in a rental. Only allowed while rental is active."""
    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")
    if user.id not in (rental.renter_id, rental.owner_id):
        raise HTTPException(status_code=403, detail="You do not have permission to send messages in this rental.")
    if rental.status not in ("active",):
        raise HTTPException(status_code=400, detail="Messages can only be sent during active rentals.")

    content = data.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")
    if len(content) > 2000:
        raise HTTPException(status_code=400, detail="Message is too long. Maximum 2000 characters.")

    msg = RentalMessage(rental_id=rental_id, sender_id=user.id, content=content)
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    await db.commit()

    return {
        "id": msg.id,
        "rental_id": msg.rental_id,
        "sender_id": msg.sender_id,
        "sender_username": user.username,
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at,
    }


@router.post("/{rental_id}/request-cancellation")
async def request_cancellation(
    rental_id: int,
    reason: str,
    description: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request rental cancellation (requires admin approval). Only renter can request."""
    from app.models.cancellation_request import CancellationRequest

    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")

    if rental.renter_id != user.id:
        raise HTTPException(status_code=403, detail="Only the renter can request a cancellation for this rental.")

    if rental.status not in ("active",):
        raise HTTPException(status_code=400, detail=f"Cancellation is not available for rentals with '{rental.status}' status.")

    existing = await db.execute(
        select(CancellationRequest).where(
            CancellationRequest.rental_id == rental_id,
            CancellationRequest.status == "pending"
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A cancellation request is already pending review for this rental.")

    request = CancellationRequest(
        rental_id=rental_id,
        requester_id=user.id,
        reason=reason,
        description=description
    )
    db.add(request)
    await db.flush()
    await db.commit()

    return {
        "message": "Cancellation request submitted successfully. Pending admin review.",
        "request_id": request.id,
        "status": "pending"
    }


@router.post("/{rental_id}/log-hashrate")
async def log_hashrate_manual(
    rental_id: int,
    measured_hashrate: float = Query(ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually log hashrate for a rental (admin or owner can log)."""
    from app.services.hashrate import log_hashrate

    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")

    if user.role != "admin" and user.id != rental.owner_id:
        raise HTTPException(status_code=403, detail="You do not have permission to access this rental.")

    if rental.status != "active":
        raise HTTPException(status_code=400, detail="This action is only available for active rentals.")

    log_entry = await log_hashrate(
        db=db,
        rental_id=rental_id,
        measured_hashrate=measured_hashrate,
        advertised_hashrate=float(rental.hashrate),
        source="manual"
    )

    await db.commit()

    percentage = (measured_hashrate / float(rental.hashrate)) * 100

    return {
        "message": "Hashrate logged successfully",
        "log_id": log_entry.id,
        "measured_hashrate": measured_hashrate,
        "advertised_hashrate": float(rental.hashrate),
        "percentage": round(percentage, 2),
        "measured_at": log_entry.measured_at
    }


@router.get("/{rental_id}/hashrate-stats")
async def get_rental_hashrate_stats(
    rental_id: int,
    hours: int = Query(24, ge=1, le=168),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get hashrate statistics for a rental."""
    from app.services.hashrate import get_hashrate_stats

    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")

    if user.id not in (rental.renter_id, rental.owner_id) and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to access this rental.")

    stats = await get_hashrate_stats(db, rental_id, hours)

    return {
        "rental_id": rental_id,
        "advertised_hashrate": float(rental.hashrate),
        "period_hours": hours,
        "stats": stats
    }


@router.get("/export/csv")
async def export_rentals_csv(
    role: str = Query("renter", pattern="^(renter|owner)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export rental history as CSV."""
    from fastapi.responses import StreamingResponse
    from app.models.rental import Rental
    from app.models.rig import Rig
    from sqlalchemy.orm import selectinload
    import csv, io

    query = select(Rental).options(
        selectinload(Rental.rig), selectinload(Rental.algorithm)
    ).order_by(Rental.created_at.desc())

    if role == "renter":
        query = query.where(Rental.renter_id == user.id)
    else:
        query = query.where(Rental.owner_id == user.id)

    result = await db.execute(query.limit(500))
    rentals = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Rig", "Algorithm", "Hashrate", "Duration(h)", "Total Cost", "Status",
                     "Performance%", "Refund", "Started", "Ended", "Created"])
    for r in rentals:
        writer.writerow([
            r.id, r.rig.name if r.rig else r.rig_id,
            r.algorithm.display_name if r.algorithm else "", float(r.hashrate),
            r.duration_hours, float(r.total_cost), r.status,
            float(r.performance_percent) if r.performance_percent else "",
            float(r.refund_amount) if r.refund_amount else 0,
            r.started_at.isoformat() if r.started_at else "",
            r.completed_at.isoformat() if r.completed_at else "",
            r.created_at.isoformat() if r.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rental_history.csv"},
    )
