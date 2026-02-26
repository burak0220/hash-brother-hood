from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Integer, Boolean, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Rental(Base):
    __tablename__ = "rentals"

    id: Mapped[int] = mapped_column(primary_key=True)
    rig_id: Mapped[int] = mapped_column(ForeignKey("rigs.id", ondelete="CASCADE"))
    renter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    algorithm_id: Mapped[int] = mapped_column(ForeignKey("algorithms.id"))
    hashrate: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False)
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    duration_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # Escrow: owner payment held until dispute window passes
    escrow_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=Decimal("0"))
    escrow_released: Mapped[bool] = mapped_column(Boolean, default=False)
    escrow_released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Dispute window: 12 hours after rental completes
    dispute_window_ends: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Auto-cancel tracking
    low_hashrate_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    # RPI at time of rental (for historical reference)
    rpi_at_start: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    # Primary pool
    pool_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pool_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pool_password: Mapped[str | None] = mapped_column(String(255), default="x")
    # Backup pool 2
    pool2_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pool2_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pool2_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Backup pool 3
    pool3_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pool3_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pool3_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Backup pool 4
    pool4_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pool4_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pool4_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Backup pool 5
    pool5_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pool5_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pool5_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Extension tracking
    original_duration_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extended_hours: Mapped[int] = mapped_column(Integer, default=0)
    extension_cost: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=Decimal("0"))
    extensions_disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # Share-based refund tracking (MRR style)
    expected_shares: Mapped[int] = mapped_column(Integer, default=0)
    actual_shares: Mapped[int] = mapped_column(Integer, default=0)
    rejected_shares: Mapped[int] = mapped_column(Integer, default=0)
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=Decimal("0"))
    refund_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # Pool & Rig status tracking
    pool_status: Mapped[str] = mapped_column(String(20), default="unknown")
    rig_online: Mapped[bool] = mapped_column(Boolean, default=True)
    # Performance tracking (filled at completion)
    actual_hashrate_avg: Mapped[Decimal | None] = mapped_column(Numeric(20, 4), nullable=True)
    performance_percent: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    # Stratum proxy info (assigned when rental starts)
    proxy_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    rig = relationship("Rig", back_populates="rentals")
    renter = relationship("User", foreign_keys=[renter_id])
    owner = relationship("User", foreign_keys=[owner_id])
    algorithm = relationship("Algorithm")
    hashrate_logs = relationship("HashrateLog", back_populates="rental")
