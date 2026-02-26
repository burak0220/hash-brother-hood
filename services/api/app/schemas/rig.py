from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.schemas.algorithm import AlgorithmResponse
from app.schemas.user import UserPublicProfile


class RigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    algorithm_id: int
    hashrate: Decimal = Field(gt=0)
    price_per_hour: Decimal = Field(gt=0)
    min_rental_hours: int = Field(default=2, ge=1)
    max_rental_hours: int = Field(default=720, ge=1, le=8760)
    region: str = "auto"
    stratum_host: str | None = None
    stratum_port: int | None = Field(default=None, ge=1, le=65535)
    worker_prefix: str | None = None
    # MRR features
    suggested_difficulty: str | None = None
    optimal_diff_min: int | None = Field(default=None, ge=1)
    optimal_diff_max: int | None = Field(default=None, ge=1)
    ndevices: int = Field(default=1, ge=1, le=10000)
    extensions_enabled: bool = True
    auto_price_enabled: bool = False
    auto_price_margin: Decimal = Field(default=Decimal("0"), ge=-50, le=100)
    owner_pool_url: str | None = None
    owner_pool_user: str | None = None
    owner_pool_password: str | None = "x"

    @model_validator(mode='after')
    def validate_rental_hours(self):
        if self.min_rental_hours > self.max_rental_hours:
            raise ValueError('min_rental_hours must be less than or equal to max_rental_hours')
        return self


class RigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    hashrate: Decimal | None = Field(default=None, gt=0)
    price_per_hour: Decimal | None = Field(default=None, gt=0)
    min_rental_hours: int | None = Field(default=None, ge=1)
    max_rental_hours: int | None = Field(default=None, ge=1, le=8760)
    status: str | None = None
    region: str | None = None
    stratum_host: str | None = None
    stratum_port: int | None = Field(default=None, ge=1, le=65535)
    worker_prefix: str | None = None
    # MRR features
    suggested_difficulty: str | None = None
    optimal_diff_min: int | None = Field(default=None, ge=1)
    optimal_diff_max: int | None = Field(default=None, ge=1)
    ndevices: int | None = Field(default=None, ge=1, le=10000)
    extensions_enabled: bool | None = None
    auto_price_enabled: bool | None = None
    auto_price_margin: Decimal | None = None
    owner_pool_url: str | None = None
    owner_pool_user: str | None = None
    owner_pool_password: str | None = None


class RigResponse(BaseModel):
    id: int
    owner_id: int
    name: str
    description: str | None = None
    algorithm_id: int
    algorithm: AlgorithmResponse | None = None
    owner: UserPublicProfile | None = None
    hashrate: Decimal
    price_per_hour: Decimal
    min_rental_hours: int
    max_rental_hours: int
    status: str
    region: str
    uptime_percentage: Decimal
    total_rentals: int
    average_rating: Decimal
    stratum_host: str | None = None
    stratum_port: int | None = None
    worker_prefix: str | None = None
    is_featured: bool
    # MRR features
    rpi_score: Decimal
    suggested_difficulty: str | None = None
    optimal_diff_min: int | None = None
    optimal_diff_max: int | None = None
    ndevices: int = 1
    extensions_enabled: bool = True
    auto_price_enabled: bool = False
    auto_price_margin: Decimal = Decimal("0")
    owner_pool_url: str | None = None
    owner_pool_user: str | None = None
    owner_pool_password: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RigListResponse(BaseModel):
    items: list[RigResponse]
    total: int
    page: int
    per_page: int
    pages: int
