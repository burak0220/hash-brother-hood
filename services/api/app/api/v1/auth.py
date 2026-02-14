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
        user = await register_user(db, data.email, data.username, data.password, data.referral_code)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
@limiter.limit(lambda: f"{settings.RATE_LIMIT_LOGIN}/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="The email or password you entered is incorrect. Please try again.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact support for assistance.")

    if user.totp_enabled:
        if not data.totp_code:
            raise HTTPException(status_code=400, detail="Two-factor authentication is required. Please enter your 2FA code.")
        if not verify_totp(user.totp_secret, data.totp_code):
            raise HTTPException(status_code=400, detail="The 2FA code you entered is incorrect. Please check your authenticator app and try again.")
        # TOTP replay protection
        if not await mark_totp_used(user.id, data.totp_code):
            raise HTTPException(status_code=400, detail="This 2FA code has already been used. Please wait for your authenticator to generate a new code.")

    return create_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    # Check user is still active
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Your account is no longer active. Please contact support.")

    return create_tokens(uid)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    user: User = Depends(get_current_user),
):
    """Logout by blacklisting the current access token."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    payload = decode_token(token)
    if payload and payload.get("jti"):
        # Blacklist for remaining token lifetime
        exp = payload.get("exp", 0)
        from datetime import datetime, timezone
        remaining = max(int(exp - datetime.now(timezone.utc).timestamp()), 0)
        if remaining > 0:
            await blacklist_token(payload["jti"], remaining)
    return {"message": "Logged out successfully"}


@router.post("/2fa/enable", response_model=Enable2FAResponse)
@limiter.limit(lambda: f"{settings.RATE_LIMIT_2FA}/minute")
async def enable_2fa(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="Two-factor authentication is already enabled on your account.")
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
        raise HTTPException(status_code=400, detail="Please initiate 2FA setup first before verifying.")
    if not verify_totp(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="The verification code is incorrect. Please check your authenticator app and try again.")
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
        raise HTTPException(status_code=400, detail="Two-factor authentication is not currently enabled on your account.")
    if not verify_totp(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="The verification code is incorrect. Please check your authenticator app and try again.")
    user.totp_enabled = False
    user.totp_secret = None
    await db.flush()
    return {"message": "2FA disabled successfully"}
