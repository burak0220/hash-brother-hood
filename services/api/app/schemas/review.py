from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.user import UserPublicProfile


class ReviewCreate(BaseModel):
    rental_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


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
