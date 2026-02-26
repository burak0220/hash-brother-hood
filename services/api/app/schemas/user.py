import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, field_validator

LTC_LEGACY_PATTERN = re.compile(r'^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$')
LTC_BECH32_PATTERN = re.compile(r'^(ltc1|tltc1)[ac-hj-np-z02-9]{39,59}$')
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
    ltc_wallet_address: str | None = None
    deposit_address: str | None = None
    referral_code: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=30)
    bio: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = None
    ltc_wallet_address: str | None = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v is not None and not USERNAME_PATTERN.match(v):
            raise ValueError('Username must be 3-30 characters long and can only contain letters, numbers, hyphens (-) and underscores (_).')
        return v

    @field_validator('ltc_wallet_address')
    @classmethod
    def validate_ltc_address(cls, v: str | None) -> str | None:
        if v is not None and not (LTC_LEGACY_PATTERN.match(v) or LTC_BECH32_PATTERN.match(v)):
            raise ValueError('Please enter a valid Litecoin wallet address (L.../M.../3... or ltc1...)')
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
