import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.rental import RentalCreate, RentalResponse, RentalListResponse
from app.services.rental import create_rental, get_rental, cancel_rental, list_user_rentals, rental_to_response

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
        raise HTTPException(status_code=404, detail="Rental not found")
    if rental.renter_id != user.id and rental.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return rental_to_response(rental)


@router.post("/{rental_id}/cancel", response_model=RentalResponse)
async def cancel(
    rental_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rental = await get_rental(db, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    if rental.renter_id != user.id and rental.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        cancelled = await cancel_rental(db, rental, user)
        full = await get_rental(db, cancelled.id)
        return rental_to_response(full)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
