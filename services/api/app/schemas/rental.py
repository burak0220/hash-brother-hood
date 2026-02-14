import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserPublicProfile

POOL_URL_PATTERN = re.compile(r'^stratum\+tcp://[a-zA-Z0-9._-]+:\d{1,5}$')


class RentalCreate(BaseModel):
    rig_id: int
    duration_hours: int = Field(ge=1)
    pool_url: str = Field(max_length=500)
    pool_user: str = Field(min_length=1, max_length=255)
    pool_password: str = Field(default="x", max_length=255)

    @field_validator('pool_url')
    @classmethod
    def validate_pool_url(cls, v: str) -> str:
        if not POOL_URL_PATTERN.match(v):
            raise ValueError('Please enter a valid pool URL in the format: stratum+tcp://hostname:port')
        return v


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
