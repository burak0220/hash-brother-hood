import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserPublicProfile

POOL_URL_PATTERN = re.compile(r'^stratum(\+tcp|\+ssl|\+tls)?://[a-zA-Z0-9._\-@/]+:\d{1,5}(/.*)?$')


def validate_pool_url(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    if not POOL_URL_PATTERN.match(v):
        raise ValueError('Please enter a valid pool URL in the format: stratum+tcp://hostname:port')
    return v


class RentalCreate(BaseModel):
    rig_id: int
    duration_hours: int = Field(ge=1)
    pool_url: str = Field(max_length=500)
    pool_user: str = Field(min_length=1, max_length=255)
    pool_password: str = Field(default="x", max_length=255)
    pool2_url: str | None = Field(default=None, max_length=500)
    pool2_user: str | None = Field(default=None, max_length=255)
    pool2_password: str | None = Field(default=None, max_length=255)
    pool3_url: str | None = Field(default=None, max_length=500)
    pool3_user: str | None = Field(default=None, max_length=255)
    pool3_password: str | None = Field(default=None, max_length=255)
    pool4_url: str | None = Field(default=None, max_length=500)
    pool4_user: str | None = Field(default=None, max_length=255)
    pool4_password: str | None = Field(default=None, max_length=255)
    pool5_url: str | None = Field(default=None, max_length=500)
    pool5_user: str | None = Field(default=None, max_length=255)
    pool5_password: str | None = Field(default=None, max_length=255)

    @field_validator('pool_url')
    @classmethod
    def validate_primary_pool_url(cls, v: str) -> str:
        if not POOL_URL_PATTERN.match(v):
            raise ValueError('Please enter a valid pool URL in the format: stratum+tcp://hostname:port')
        return v

    @field_validator('pool2_url', 'pool3_url', 'pool4_url', 'pool5_url', mode='before')
    @classmethod
    def validate_backup_pool_url(cls, v: str | None) -> str | None:
        return validate_pool_url(v)


class RentalPoolUpdate(BaseModel):
    pool_url: str = Field(max_length=500)
    pool_user: str = Field(min_length=1, max_length=255)
    pool_password: str = Field(default="x", max_length=255)
    pool2_url: str | None = Field(default=None, max_length=500)
    pool2_user: str | None = Field(default=None, max_length=255)
    pool2_password: str | None = Field(default=None, max_length=255)
    pool3_url: str | None = Field(default=None, max_length=500)
    pool3_user: str | None = Field(default=None, max_length=255)
    pool3_password: str | None = Field(default=None, max_length=255)
    pool4_url: str | None = Field(default=None, max_length=500)
    pool4_user: str | None = Field(default=None, max_length=255)
    pool4_password: str | None = Field(default=None, max_length=255)
    pool5_url: str | None = Field(default=None, max_length=500)
    pool5_user: str | None = Field(default=None, max_length=255)
    pool5_password: str | None = Field(default=None, max_length=255)

    @field_validator('pool_url')
    @classmethod
    def validate_primary_pool_url(cls, v: str) -> str:
        if not POOL_URL_PATTERN.match(v):
            raise ValueError('Please enter a valid pool URL in the format: stratum+tcp://hostname:port')
        return v

    @field_validator('pool2_url', 'pool3_url', 'pool4_url', 'pool5_url', mode='before')
    @classmethod
    def validate_backup_pool_url(cls, v: str | None) -> str | None:
        return validate_pool_url(v)


class RentalExtend(BaseModel):
    """Extend an active rental's duration."""
    hours: int = Field(ge=1, le=720, description="Additional hours to extend")


class RentalResponse(BaseModel):
    id: int
    rig_id: int
    rig_name: str | None = None
    rig_region: str | None = None
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
    escrow_amount: Decimal = Decimal("0")
    escrow_released: bool = False
    status: str
    pool_url: str | None = None
    pool_user: str | None = None
    pool_password: str | None = None
    pool2_url: str | None = None
    pool2_user: str | None = None
    pool2_password: str | None = None
    pool3_url: str | None = None
    pool3_user: str | None = None
    pool3_password: str | None = None
    pool4_url: str | None = None
    pool4_user: str | None = None
    pool4_password: str | None = None
    pool5_url: str | None = None
    pool5_user: str | None = None
    pool5_password: str | None = None
    actual_hashrate_avg: Decimal | None = None
    performance_percent: Decimal | None = None
    # Extension info
    original_duration_hours: int | None = None
    extended_hours: int = 0
    extension_cost: Decimal = Decimal("0")
    extensions_disabled: bool = False
    # Share-based refund info
    expected_shares: int = 0
    actual_shares: int = 0
    rejected_shares: int = 0
    refund_amount: Decimal = Decimal("0")
    refund_reason: str | None = None
    reviewed_at: datetime | None = None
    # RPI at rental start
    rpi_at_start: Decimal | None = None
    # Timestamps
    dispute_window_ends: datetime | None = None
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
