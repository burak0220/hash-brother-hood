from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    role: str
    balance: Decimal
    is_active: bool
    is_verified: bool
    totp_enabled: bool
    avatar_url: str | None = None
    bio: str | None = None
    bsc_wallet_address: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    bsc_wallet_address: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserPublicProfile(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
