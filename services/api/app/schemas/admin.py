from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_verified: bool | None = None
    role: Literal["user", "admin"] | None = None
    balance: Decimal | None = None


class AdminBalanceAdjust(BaseModel):
    amount: Decimal
    reason: str = Field(default="", max_length=500)


class AdminSendNotification(BaseModel):
    user_id: int | None = None  # None = broadcast to all
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1, max_length=2000)
    link: str | None = None


class PlatformSettingUpdate(BaseModel):
    value: str


class PlatformSettingResponse(BaseModel):
    id: int
    key: str
    value: str
    description: str | None = None
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminStatsResponse(BaseModel):
    total_users: int
    total_rigs: int
    total_rentals: int
    total_revenue: float
    active_rentals: int
    pending_withdrawals: int


class AuditLogResponse(BaseModel):
    id: int
    admin_id: int
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    details: dict | None = None
    ip_address: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
