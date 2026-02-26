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


# ── Sprint 2: Granular Admin Controls ──────────────────────────────────────


class AdminRPIOverride(BaseModel):
    """Manually override a rig's RPI score."""
    rpi_score: Decimal = Field(ge=0, le=100, description="New RPI score (0-100)")
    reason: str = Field(min_length=1, max_length=500)


class AdminRentalReview(BaseModel):
    """Admin review of a completed rental — adjust/approve/reject refund."""
    action: Literal["approve_refund", "reject_refund", "adjust_refund", "force_refund"]
    refund_amount: Decimal | None = Field(default=None, ge=0, description="Custom refund amount (for adjust/force)")
    reason: str = Field(default="", max_length=500)


class AdminRigCorrection(BaseModel):
    """Admin correction of rig's advertised hashrate or status."""
    hashrate: Decimal | None = Field(default=None, gt=0)
    status: Literal["active", "inactive", "maintenance", "disabled"] | None = None
    reason: str = Field(min_length=1, max_length=500)


class MassRentRequest(BaseModel):
    """Bulk rent multiple rigs with same pool config."""
    rig_ids: list[int] = Field(min_length=1, max_length=20)
    duration_hours: int = Field(ge=1)
    pool_url: str = Field(max_length=500)
    pool_user: str = Field(min_length=1, max_length=255)
    pool_password: str = Field(default="x", max_length=255)
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
