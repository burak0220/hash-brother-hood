from datetime import datetime

from sqlalchemy import String, Numeric, DateTime, ForeignKey, func, Index
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
    source: Mapped[str] = mapped_column(String(50), default="pool_api")  # pool_api, manual, webhook
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rental = relationship("Rental", back_populates="hashrate_logs")

    __table_args__ = (
        Index("idx_hashrate_rental", "rental_id"),
        Index("idx_hashrate_measured_at", "measured_at"),
    )
