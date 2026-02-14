from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Boolean, Numeric, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="user")
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    totp_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    bsc_wallet_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deposit_address: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    deposit_hd_index: Mapped[int | None] = mapped_column(nullable=True)
    referral_code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    referred_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    rigs = relationship("Rig", back_populates="owner", foreign_keys="Rig.owner_id")
    transactions = relationship("Transaction", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
