"""Internal API endpoints for microservices communication (stratum proxy → API)."""

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.hashrate_log import HashrateLog
from app.models.rental import Rental
from app.models.rig import Rig

router = APIRouter(prefix="/internal", tags=["Internal"])


def verify_internal_key(x_internal_key: str = Header(...)):
    """Verify internal API key from stratum proxy."""
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    return True


# ── Pool config ─────────────────────────────────────────────────────────────

@router.get("/rig/{rig_id}/pool-config")
async def get_rig_pool_config(
    rig_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """
    Return the pool the stratum proxy should use for this rig.

    Priority:
      1. Active rental → renter's primary pool
      2. No active rental → rig owner's fallback pool
      3. Neither → 404
    """
    # 1. Check for active rental
    result = await db.execute(
        select(Rental).where(
            Rental.rig_id == rig_id,
            Rental.status == "active",
        )
    )
    rental = result.scalar_one_or_none()

    if rental and rental.pool_url:
        return {
            "pool_url":      rental.pool_url,
            "pool_user":     rental.pool_user or "",
            "pool_password": rental.pool_password or "x",
            "rental_id":     rental.id,
            "mode":          "rental",
        }

    # 2. Fall back to owner's pool
    result = await db.execute(select(Rig).where(Rig.id == rig_id))
    rig = result.scalar_one_or_none()

    if not rig:
        raise HTTPException(status_code=404, detail="Rig not found")

    if rig.owner_pool_url:
        return {
            "pool_url":      rig.owner_pool_url,
            "pool_user":     rig.owner_pool_user or "",
            "pool_password": rig.owner_pool_password or "x",
            "rental_id":     None,
            "mode":          "idle",
        }

    raise HTTPException(status_code=404, detail="No pool configured for this rig")


# ── Hashrate report ──────────────────────────────────────────────────────────

class HashrateReport(BaseModel):
    rig_id: int
    accepted_shares: int
    rejected_shares: int
    total_shares: int
    elapsed_seconds: float
    current_diff: float
    measured_hashrate: float   # H/s, calculated by proxy


@router.post("/hashrate-report")
async def hashrate_report(
    data: HashrateReport,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """
    Receive a share-based hashrate report from the stratum proxy.

    Called every REPORT_INTERVAL seconds (default 5 min) per rig.
    Stores a HashrateLog entry and updates rental share counters.
    """
    # Find active rental for this rig
    result = await db.execute(
        select(Rental).where(
            Rental.rig_id == data.rig_id,
            Rental.status == "active",
        )
    )
    rental = result.scalar_one_or_none()

    if not rental:
        # Idle rig — proxy is mining to owner's pool, nothing to log
        return {"status": "ok", "logged": False, "reason": "no active rental"}

    advertised = float(rental.hashrate)
    measured   = data.measured_hashrate
    percentage = (measured / advertised * 100) if advertised > 0 else 0.0
    elapsed    = max(data.elapsed_seconds, 1.0)
    share_rate = data.accepted_shares / elapsed

    log = HashrateLog(
        rental_id=rental.id,
        measured_hashrate=measured,
        advertised_hashrate=advertised,
        percentage=percentage,
        shares_accepted=data.accepted_shares,
        shares_rejected=data.rejected_shares,
        difficulty=data.current_diff,
        share_rate=share_rate,
        source="stratum_proxy",
    )
    db.add(log)

    # Accumulate share counters on the rental row
    rental.actual_shares   = (rental.actual_shares   or 0) + data.accepted_shares
    rental.rejected_shares = (rental.rejected_shares or 0) + data.rejected_shares

    await db.commit()

    return {
        "status":    "ok",
        "logged":    True,
        "rental_id": rental.id,
        "hashrate_gh": round(measured / 1e9, 4),
        "efficiency":  round(percentage, 2),
    }


# ── Health ───────────────────────────────────────────────────────────────────

@router.get("/health")
async def internal_health():
    """Health check for internal services."""
    return {"status": "healthy", "service": "api"}
