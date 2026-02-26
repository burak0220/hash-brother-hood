"""Support ticket models."""

from datetime import datetime
from sqlalchemy import String, Integer, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="general")  # general, billing, technical, dispute
    priority: Mapped[str] = mapped_column(String(20), default="normal")  # low, normal, high, urgent
    status: Mapped[str] = mapped_column(String(20), default="open")  # open, in_progress, resolved, closed
    rental_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("rentals.id"), nullable=True)
    assigned_to: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    messages = relationship("SupportMessage", back_populates="ticket", order_by="SupportMessage.created_at")


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_id: Mapped[int] = mapped_column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)  # Admin-only notes
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")

    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
