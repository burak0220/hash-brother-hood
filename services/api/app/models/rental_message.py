from datetime import datetime

from sqlalchemy import String, Boolean, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RentalMessage(Base):
    """Chat messages between renter and rig owner, tied to a specific rental."""
    __tablename__ = "rental_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    rental_id: Mapped[int] = mapped_column(ForeignKey("rentals.id", ondelete="CASCADE"))
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rental = relationship("Rental")
    sender = relationship("User", foreign_keys=[sender_id])
