from datetime import datetime
from decimal import Decimal

from sqlalchemy import Integer, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RentalExtension(Base):
    __tablename__ = "rental_extensions"

    id: Mapped[int] = mapped_column(primary_key=True)
    rental_id: Mapped[int] = mapped_column(ForeignKey("rentals.id", ondelete="CASCADE"))
    hours: Mapped[int] = mapped_column(Integer, nullable=False)
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rental = relationship("Rental")
