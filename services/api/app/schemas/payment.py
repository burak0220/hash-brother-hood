import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


# LTC address patterns: Legacy (L/M/3 prefix) + Bech32 (ltc1 prefix) + Testnet (tltc1)
LTC_LEGACY_PATTERN = re.compile(r'^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$')
LTC_BECH32_PATTERN = re.compile(r'^(ltc1|tltc1)[ac-hj-np-z02-9]{39,59}$')


class BalanceResponse(BaseModel):
    balance: Decimal


class PlatformAddressResponse(BaseModel):
    address: str


class DepositRequest(BaseModel):
    amount: Decimal = Field(gt=0)
    tx_hash: str


class WithdrawRequest(BaseModel):
    amount: Decimal = Field(ge=Decimal("0.001"), le=1_000_000)
    wallet_address: str

    @field_validator('wallet_address')
    @classmethod
    def validate_ltc_address(cls, v: str) -> str:
        if not (LTC_LEGACY_PATTERN.match(v) or LTC_BECH32_PATTERN.match(v)):
            raise ValueError('Please enter a valid Litecoin wallet address (L.../M.../3... or ltc1...)')
        return v


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
