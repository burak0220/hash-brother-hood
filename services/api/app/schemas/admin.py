from datetime import datetime

from pydantic import BaseModel


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_verified: bool | None = None
    role: str | None = None
    balance: float | None = None


class AdminBalanceAdjust(BaseModel):
    amount: float
    reason: str = ""


class AdminSendNotification(BaseModel):
    user_id: int | None = None  # None = broadcast to all
    title: str
    message: str
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
