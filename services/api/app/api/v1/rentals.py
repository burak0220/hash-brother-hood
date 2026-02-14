import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.rental import RentalCreate, RentalResponse, RentalListResponse
from app.services.rental import create_rental, get_rental, cancel_rental, list_user_rentals, rental_to_response
from app.services.hashrate import can_renter_cancel

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
        )
        full = await get_rental(db, rental.id)
        return rental_to_response(full)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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


@router.post("/{rental_id}/request-cancellation")
async def request_cancellation(
    rental_id: int,
    reason: str,
    description: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Request rental cancellation (requires admin approval).

    Only renter can request cancellation.
    Admin will review hashrate data and approve/reject.
    """
    from app.models.cancellation_request import CancellationRequest
    from sqlalchemy import select

    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")

    # Only renter can request cancellation
    if rental.renter_id != user.id:
        raise HTTPException(status_code=403, detail="Only the renter can request a cancellation for this rental.")

    # Can't cancel pending or already cancelled rentals
    if rental.status not in ("active",):
        raise HTTPException(status_code=400, detail=f"Cancellation is not available for rentals with '{rental.status}' status. Only active rentals can be cancelled.")

    # Check if already has pending request
    existing = await db.execute(
        select(CancellationRequest).where(
            CancellationRequest.rental_id == rental_id,
            CancellationRequest.status == "pending"
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A cancellation request is already pending review for this rental. Please wait for admin approval.")

    # Create request
    request = CancellationRequest(
        rental_id=rental_id,
        requester_id=user.id,
        reason=reason,
        description=description
    )
    db.add(request)
    await db.flush()

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
    """
    Manually log hashrate for a rental (admin or owner can log).
    In production, this should be called automatically by monitoring system.
    """
    from app.services.hashrate import log_hashrate

    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")
    
    # Only admin or rig owner can log hashrate
    if user.role != "admin" and user.id != rental.owner_id:
        raise HTTPException(status_code=403, detail="You do not have permission to access this rental.")
    
    if rental.status != "active":
        raise HTTPException(status_code=400, detail="This action is only available for active rentals.")
    
    # Log the hashrate
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
    hours: int = Query(24, ge=1, le=168),  # 1 hour to 7 days
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get hashrate statistics for a rental."""
    from app.services.hashrate import get_hashrate_stats
    
    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="The requested rental could not be found.")
    
    # Renter, owner, or admin can view stats
    if user.id not in (rental.renter_id, rental.owner_id) and user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to access this rental.")
    
    stats = await get_hashrate_stats(db, rental_id, hours)
    
    return {
        "rental_id": rental_id,
        "advertised_hashrate": float(rental.hashrate),
        "period_hours": hours,
        "stats": stats
    }
