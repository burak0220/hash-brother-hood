from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse
from app.services.review import create_review, list_rig_reviews

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("", response_model=ReviewResponse, status_code=201)
async def create(
    data: ReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        review = await create_review(db, user.id, data.rental_id, data.rating, data.comment)
        return review
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/rig/{rig_id}", response_model=list[ReviewResponse])
async def get_rig_reviews(rig_id: int, db: AsyncSession = Depends(get_db)):
    reviews = await list_rig_reviews(db, rig_id)
    result = []
    for r in reviews:
        data = {
            "id": r.id, "rental_id": r.rental_id, "rig_id": r.rig_id,
            "reviewer_id": r.reviewer_id, "rating": r.rating,
            "comment": r.comment, "created_at": r.created_at,
        }
        if r.reviewer:
            data["reviewer"] = {
                "id": r.reviewer.id, "username": r.reviewer.username,
                "avatar_url": r.reviewer.avatar_url, "bio": r.reviewer.bio,
                "created_at": r.reviewer.created_at,
            }
        result.append(data)
    return result
