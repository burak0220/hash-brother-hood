from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.user import UserPublicProfile


class RentalCreate(BaseModel):
    rig_id: int
    duration_hours: int
    pool_url: str
    pool_user: str
    pool_password: str = "x"


class RentalResponse(BaseModel):
    id: int
    rig_id: int
    rig_name: str | None = None
    renter_id: int
    renter: UserPublicProfile | None = None
    owner_id: int
    owner: UserPublicProfile | None = None
    algorithm_id: int
    algorithm_name: str | None = None
    hashrate: Decimal
    price_per_hour: Decimal
    duration_hours: int | None = None
    total_cost: Decimal
    status: str
    pool_url: str | None = None
    pool_user: str | None = None
    pool_password: str | None = None
    started_at: datetime | None = None
    ends_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RentalListResponse(BaseModel):
    items: list[RentalResponse]
    total: int
    page: int
    per_page: int
    pages: int
