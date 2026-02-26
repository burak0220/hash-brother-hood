from datetime import datetime

from sqlalchemy import String, Boolean, BigInteger, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Algorithm(Base):
    __tablename__ = "algorithms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="TH/s")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Coins mined by this algorithm (e.g. "Bitcoin, Bitcoin Cash")
    coins: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Platform-wide difficulty defaults — rig owner can override per-rig
    diff_suggested: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    diff_min: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    diff_max: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
