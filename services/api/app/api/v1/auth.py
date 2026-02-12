from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import decode_token, generate_totp_secret, verify_totp, get_totp_uri
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, Enable2FAResponse, Verify2FARequest,
)
from app.schemas.user import UserResponse
from app.schemas.common import MessageResponse
from app.services.auth import register_user, authenticate_user, create_tokens

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await register_user(db, data.email, data.username, data.password)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
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

    return create_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return create_tokens(int(user_id))


@router.post("/2fa/enable", response_model=Enable2FAResponse)
async def enable_2fa(
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
async def verify_2fa(
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
async def disable_2fa(
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
