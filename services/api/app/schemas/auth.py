import re

from pydantic import BaseModel, EmailStr, Field, field_validator

USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{3,30}$')


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    referral_code: str | None = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not USERNAME_PATTERN.match(v):
            raise ValueError('Username must be 3-30 characters long and can only contain letters, numbers, hyphens (-) and underscores (_).')
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    totp_code: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class Enable2FAResponse(BaseModel):
    secret: str
    uri: str


class Verify2FARequest(BaseModel):
    code: str
