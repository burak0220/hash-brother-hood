from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, func
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
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    duration_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    pool_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pool_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pool_password: Mapped[str | None] = mapped_column(String(255), default="x")
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
