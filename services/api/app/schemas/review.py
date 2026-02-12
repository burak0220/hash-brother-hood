from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserPublicProfile


class ReviewCreate(BaseModel):
    rental_id: int
    rating: int
    comment: str | None = None


class ReviewResponse(BaseModel):
    id: int
    rental_id: int
    rig_id: int
    reviewer_id: int
    reviewer: UserPublicProfile | None = None
    rating: int
    comment: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
