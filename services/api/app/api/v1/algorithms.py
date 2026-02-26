import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.algorithm import Algorithm
from app.models.user import User
from app.schemas.algorithm import AlgorithmResponse, AlgorithmCreate

router = APIRouter(prefix="/algorithms", tags=["Algorithms"])


@router.get("", response_model=list[AlgorithmResponse])
async def list_algorithms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Algorithm).where(Algorithm.is_active == True).order_by(Algorithm.display_name))
    return list(result.scalars().all())


@router.post("", response_model=AlgorithmResponse, status_code=201)
async def create_algorithm(
    data: AlgorithmCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Any logged-in rig owner can add a new algorithm."""
    # Generate slug from display name
    name = re.sub(r'[^a-z0-9]+', '', data.display_name.lower())
    if not name:
        raise HTTPException(status_code=400, detail="Algorithm name is invalid")

    # Check if already exists
    existing = await db.execute(select(Algorithm).where(Algorithm.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This algorithm already exists")

    algo = Algorithm(
        name=name,
        display_name=data.display_name,
        unit=data.unit,
        is_active=True,
    )
    db.add(algo)
    await db.commit()
    await db.refresh(algo)
    return algo
