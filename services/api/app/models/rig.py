from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Integer, Boolean, Numeric, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Rig(Base):
    __tablename__ = "rigs"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    algorithm_id: Mapped[int] = mapped_column(ForeignKey("algorithms.id"))
    hashrate: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False)
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    min_rental_hours: Mapped[int] = mapped_column(Integer, default=1)
    max_rental_hours: Mapped[int] = mapped_column(Integer, default=720)
    status: Mapped[str] = mapped_column(String(20), default="active")
    region: Mapped[str] = mapped_column(String(50), default="auto")
    uptime_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("99.00"))
    total_rentals: Mapped[int] = mapped_column(Integer, default=0)
    average_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0"))
    stratum_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stratum_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    worker_prefix: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- MRR Feature Parity ---
    # RPI (Rig Performance Index) — 0-100, auto-calculated from hashrate consistency, uptime, refunds
    rpi_score: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("100.00"))
    # Suggested work difficulty for renters
    suggested_difficulty: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Optimal difficulty range — min/max acceptable work difficulty for this rig
    # If set, pool must send work within this range or shares will be invalid
    optimal_diff_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    optimal_diff_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Number of physical mining devices making up this rig
    ndevices: Mapped[int] = mapped_column(Integer, default=1)
    # Allow renters to extend active rentals
    extensions_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Auto pricing — adjust price based on market average
    auto_price_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_price_margin: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    # Owner's fallback pool (used when not rented or all renter pools fail)
    owner_pool_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    owner_pool_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_pool_password: Mapped[str | None] = mapped_column(String(255), default="x")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="rigs", foreign_keys=[owner_id])
    algorithm = relationship("Algorithm")
    reviews = relationship("Review", back_populates="rig")
    rentals = relationship("Rental", back_populates="rig")
