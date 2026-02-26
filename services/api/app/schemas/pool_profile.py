import re
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

POOL_URL_PATTERN = re.compile(r'^stratum(\+tcp|\+ssl|\+tls)?://[a-zA-Z0-9._\-@/]+:\d{1,5}(/.*)?$')


def _validate_pool_url(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    if not POOL_URL_PATTERN.match(v):
        raise ValueError('Please enter a valid pool URL in the format: stratum+tcp://hostname:port')
    return v


class PoolProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    algorithm_id: int | None = None
    # Primary pool (required)
    pool_url: str = Field(max_length=500)
    pool_user: str = Field(min_length=1, max_length=255)
    pool_password: str = Field(default="x", max_length=255)
    # Backup pools 2-5 (optional)
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
    is_default: bool = False

    @field_validator('pool_url')
    @classmethod
    def validate_pool_url(cls, v: str) -> str:
        if not POOL_URL_PATTERN.match(v):
            raise ValueError('Please enter a valid pool URL in the format: stratum+tcp://hostname:port')
        return v

    @field_validator('pool2_url', 'pool3_url', 'pool4_url', 'pool5_url', mode='before')
    @classmethod
    def validate_backup_pool_url(cls, v: str | None) -> str | None:
        return _validate_pool_url(v)


class PoolProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    algorithm_id: int | None = None
    pool_url: str | None = Field(default=None, max_length=500)
    pool_user: str | None = Field(default=None, min_length=1, max_length=255)
    pool_password: str | None = Field(default=None, max_length=255)
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
    is_default: bool | None = None

    @field_validator('pool_url', mode='before')
    @classmethod
    def validate_pool_url(cls, v: str | None) -> str | None:
        return _validate_pool_url(v)

    @field_validator('pool2_url', 'pool3_url', 'pool4_url', 'pool5_url', mode='before')
    @classmethod
    def validate_backup_pool_url(cls, v: str | None) -> str | None:
        return _validate_pool_url(v)


class PoolProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    algorithm_id: int | None = None
    algorithm_name: str | None = None
    pool_url: str
    pool_user: str
    pool_password: str
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
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
