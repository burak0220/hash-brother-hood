from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.algorithm import AlgorithmResponse
from app.schemas.user import UserPublicProfile


class RigCreate(BaseModel):
    name: str
    description: str | None = None
    algorithm_id: int
    hashrate: Decimal
    price_per_hour: Decimal
    min_rental_hours: int = 1
    max_rental_hours: int = 720
    region: str = "auto"
    stratum_host: str | None = None
    stratum_port: int | None = None
    worker_prefix: str | None = None


class RigUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    hashrate: Decimal | None = None
    price_per_hour: Decimal | None = None
    min_rental_hours: int | None = None
    max_rental_hours: int | None = None
    status: str | None = None
    region: str | None = None
    stratum_host: str | None = None
    stratum_port: int | None = None
    worker_prefix: str | None = None


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
