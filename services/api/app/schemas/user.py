import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, field_validator

BSC_ADDRESS_PATTERN = re.compile(r'^0x[0-9a-fA-F]{40}$')
USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{3,30}$')


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
    username: str | None = Field(default=None, min_length=3, max_length=30)
    bio: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = None
    bsc_wallet_address: str | None = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v is not None and not USERNAME_PATTERN.match(v):
            raise ValueError('Username must be 3-30 characters and contain only letters, numbers, hyphens and underscores')
        return v

    @field_validator('bsc_wallet_address')
    @classmethod
    def validate_bsc_address(cls, v: str | None) -> str | None:
        if v is not None and not BSC_ADDRESS_PATTERN.match(v):
            raise ValueError('Invalid BSC wallet address (must be 0x + 40 hex characters)')
        return v


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserPublicProfile(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
