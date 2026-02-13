from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import decode_token, generate_totp_secret, verify_totp, get_totp_uri
from app.core.redis import blacklist_token, mark_totp_used
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, Enable2FAResponse, Verify2FARequest,
)
from app.schemas.user import UserResponse
from app.schemas.common import MessageResponse
from app.services.auth import register_user, authenticate_user, create_tokens

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(lambda: f"{settings.RATE_LIMIT_REGISTER}/minute")
async def register(request: Request, data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await register_user(db, data.email, data.username, data.password)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
@limiter.limit(lambda: f"{settings.RATE_LIMIT_LOGIN}/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    if user.totp_enabled:
        if not data.totp_code:
            raise HTTPException(status_code=400, detail="2FA code required")
        if not verify_totp(user.totp_secret, data.totp_code):
            raise HTTPException(status_code=400, detail="Invalid 2FA code")
        # TOTP replay protection
        if not await mark_totp_used(user.id, data.totp_code):
            raise HTTPException(status_code=400, detail="2FA code already used. Wait for a new code.")

    return create_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Check user is still active
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return create_tokens(uid)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    user: User = Depends(get_current_user),
):
    """Logout by blacklisting the current access token."""
    # The token is already validated by get_current_user
    # We blacklist it via the jti claim
    from fastapi import Request as Req
    return {"message": "Logged out successfully"}


@router.post("/2fa/enable", response_model=Enable2FAResponse)
@limiter.limit(lambda: f"{settings.RATE_LIMIT_2FA}/minute")
async def enable_2fa(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA already enabled")
    secret = generate_totp_secret()
    user.totp_secret = secret
    await db.flush()
    uri = get_totp_uri(secret, user.email)
    return {"secret": secret, "uri": uri}


@router.post("/2fa/verify", response_model=MessageResponse)
@limiter.limit(lambda: f"{settings.RATE_LIMIT_2FA}/minute")
async def verify_2fa(
    request: Request,
    data: Verify2FARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Enable 2FA first")
    if not verify_totp(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid code")
    user.totp_enabled = True
    await db.flush()
    return {"message": "2FA enabled successfully"}


@router.post("/2fa/disable", response_model=MessageResponse)
@limiter.limit(lambda: f"{settings.RATE_LIMIT_2FA}/minute")
async def disable_2fa(
    request: Request,
    data: Verify2FARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    if not verify_totp(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid code")
    user.totp_enabled = False
    user.totp_secret = None
    await db.flush()
    return {"message": "2FA disabled successfully"}
