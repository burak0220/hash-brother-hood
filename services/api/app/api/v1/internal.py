"""Internal API endpoints for microservices communication."""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import settings
from app.models.rental import Rental

router = APIRouter(prefix="/internal", tags=["Internal"])


class HashrateUpdate(BaseModel):
    rental_id: int
    measured_hashrate: float
    difficulty: float = 1.0  # Share difficulty
    shares_count: int = 0  # Number of shares in this update


def verify_internal_key(x_internal_key: str = Header(...)):
    """Verify internal API key from stratum proxy."""
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    return True


@router.post("/hashrate-update")
async def update_hashrate(
    data: HashrateUpdate,
    db: AsyncSession = Depends(get_db),
    _verified: bool = Depends(verify_internal_key),
):
    """
    Receive hashrate update from stratum proxy.

    Called every minute by proxy with measured hashrate.
    """
    from app.services.hashrate import log_hashrate

    # Verify rental exists and is active
    rental = await db.get(Rental, data.rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")

    if rental.status != "active":
        raise HTTPException(status_code=400, detail="Rental is not active")

    # Log the hashrate
    await log_hashrate(
        db=db,
        rental_id=data.rental_id,
        measured_hashrate=data.measured_hashrate,
        advertised_hashrate=float(rental.hashrate),
        source="stratum_proxy"
    )

    await db.commit()

    return {
        "status": "ok",
        "rental_id": data.rental_id,
        "logged": True
    }


@router.get("/health")
async def internal_health():
    """Health check for internal services."""
    return {"status": "healthy", "service": "api"}
