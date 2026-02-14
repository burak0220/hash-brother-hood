import secrets
import string
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.services.hdwallet import derive_address_only

logger = logging.getLogger(__name__)


def _generate_referral_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "HBH-" + "".join(secrets.choice(chars) for _ in range(8))


async def register_user(db: AsyncSession, email: str, username: str, password: str, referral_code: str | None = None) -> User:
    existing = await db.execute(select(User).where((User.email == email) | (User.username == username)))
    if existing.scalar_one_or_none():
        raise ValueError("An account with this email or username already exists. Please try a different one.")

    referred_by = None
    if referral_code:
        result = await db.execute(select(User).where(User.referral_code == referral_code))
        referrer = result.scalar_one_or_none()
        if referrer:
            referred_by = referrer.id

    user = User(
        email=email,
        username=username,
        password_hash=hash_password(password),
        referral_code=_generate_referral_code(),
        referred_by=referred_by,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Generate unique deposit address using HD wallet
    try:
        deposit_address = derive_address_only(user.id)
        user.deposit_address = deposit_address
        user.deposit_hd_index = user.id
        await db.flush()
        logger.info(f"Generated deposit address for user {user.id}: {deposit_address}")
    except Exception as e:
        logger.warning(f"Failed to generate deposit address for user {user.id}: {e}")
        # Don't fail registration if address generation fails

    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def create_tokens(user_id: int) -> dict:
    data = {"sub": str(user_id)}
    return {
        "access_token": create_access_token(data),
        "refresh_token": create_refresh_token(data),
        "token_type": "bearer",
    }
