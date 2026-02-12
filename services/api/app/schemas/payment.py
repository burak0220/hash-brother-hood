import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


BSC_ADDRESS_PATTERN = re.compile(r'^0x[0-9a-fA-F]{40}$')


class BalanceResponse(BaseModel):
    balance: Decimal


class DepositRequest(BaseModel):
    amount: Decimal
    tx_hash: str


class WithdrawRequest(BaseModel):
    amount: Decimal
    wallet_address: str

    @field_validator('wallet_address')
    @classmethod
    def validate_bsc_address(cls, v: str) -> str:
        if not BSC_ADDRESS_PATTERN.match(v):
            raise ValueError('Invalid BSC wallet address (must be 0x + 40 hex characters)')
        return v


class PlatformAddressResponse(BaseModel):
    address: str


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    type: str
    amount: Decimal
    fee: Decimal
    status: str
    tx_hash: str | None = None
    wallet_address: str | None = None
    description: str | None = None
    reference_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    per_page: int
    pages: int
