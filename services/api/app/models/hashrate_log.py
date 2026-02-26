from datetime import datetime

from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class HashrateLog(Base):
    """Log of actual hashrate measurements for rentals."""
    __tablename__ = "hashrate_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    rental_id: Mapped[int] = mapped_column(ForeignKey("rentals.id", ondelete="CASCADE"))
    measured_hashrate: Mapped[float] = mapped_column(Numeric(20, 4), nullable=False)
    advertised_hashrate: Mapped[float] = mapped_column(Numeric(20, 4), nullable=False)
    percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)  # measured/advertised * 100
    # Share tracking fields (from stratum proxy)
    shares_accepted: Mapped[int] = mapped_column(Integer, default=0)
    shares_rejected: Mapped[int] = mapped_column(Integer, default=0)
    shares_stale: Mapped[int] = mapped_column(Integer, default=0)
    difficulty: Mapped[float] = mapped_column(Numeric(20, 6), default=1.0)  # pool difficulty
    share_rate: Mapped[float] = mapped_column(Numeric(10, 4), default=0.0)  # shares per second
    # RPI contribution: (accepted shares * difficulty) / expected shares * 100
    rpi: Mapped[float] = mapped_column(Numeric(6, 2), default=0.0)
    source: Mapped[str] = mapped_column(String(50), default="pool_api")  # stratum_proxy, pool_api, manual
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rental = relationship("Rental", back_populates="hashrate_logs")

    __table_args__ = (
        Index("idx_hashrate_rental", "rental_id"),
        Index("idx_hashrate_measured_at", "measured_at"),
    )
