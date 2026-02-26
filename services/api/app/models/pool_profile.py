from datetime import datetime

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PoolProfile(Base):
    """Saved pool configuration with 5-pool failover (MRR style).

    Users save pool profiles per algorithm. When renting, they pick a profile
    and all 5 pools are loaded into the rental automatically.
    """
    __tablename__ = "pool_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    algorithm_id: Mapped[int | None] = mapped_column(ForeignKey("algorithms.id"), nullable=True)
    # Primary pool (required)
    pool_url: Mapped[str] = mapped_column(String(500), nullable=False)
    pool_user: Mapped[str] = mapped_column(String(255), nullable=False)
    pool_password: Mapped[str] = mapped_column(String(255), default="x")
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

    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="pool_profiles")
    algorithm = relationship("Algorithm")
