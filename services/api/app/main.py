import asyncio

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.api.v1 import auth, users, algorithms, rigs, rentals, payments, notifications, reviews, admin, messages, favorites, disputes, internal
from app.services.scheduler import scheduler_loop

limiter = Limiter(key_func=get_remote_address)

docs_url = "/docs" if settings.ENV != "production" else None
redoc_url = "/redoc" if settings.ENV != "production" else None


async def _ensure_admin():
    """Ensure admin account exists with correct password and deposit address on startup."""
    import logging
    from app.core.database import async_session
    from app.core.security import hash_password, verify_password
    from sqlalchemy import text

    logger = logging.getLogger(__name__)
    default_pw = "Admin123!"

    try:
        async with async_session() as db:
            result = await db.execute(text("SELECT id, password_hash, deposit_address FROM users WHERE email = 'admin@hashbrotherhood.com'"))
            row = result.fetchone()
            if row:
                updated = False
                if not verify_password(default_pw, row[1]):
                    new_hash = hash_password(default_pw)
                    await db.execute(text("UPDATE users SET password_hash = :h WHERE id = :id"), {"h": new_hash, "id": row[0]})
                    updated = True
                    logger.info("Admin password hash re-synced")
                if not row[2]:
                    try:
                        from app.services.hdwallet import derive_address_only
                        addr = derive_address_only(row[0])
                        await db.execute(text("UPDATE users SET deposit_address = :a, deposit_hd_index = :idx WHERE id = :id"), {"a": addr, "idx": row[0], "id": row[0]})
                        updated = True
                        logger.info(f"Admin deposit address generated: {addr}")
                    except Exception as e:
                        logger.warning(f"Could not generate admin deposit address: {e}")
                if updated:
                    await db.commit()
            else:
                new_hash = hash_password(default_pw)
                await db.execute(text(
                    "INSERT INTO users (email, username, password_hash, role, is_active, is_verified) "
                    "VALUES ('admin@hashbrotherhood.com', 'admin', :h, 'admin', true, true)"
                ), {"h": new_hash})
                await db.commit()
                # Generate deposit address for new admin
                result = await db.execute(text("SELECT id FROM users WHERE email = 'admin@hashbrotherhood.com'"))
                admin_row = result.fetchone()
                if admin_row:
                    try:
                        from app.services.hdwallet import derive_address_only
                        addr = derive_address_only(admin_row[0])
                        await db.execute(text("UPDATE users SET deposit_address = :a, deposit_hd_index = :idx WHERE id = :id"), {"a": addr, "idx": admin_row[0], "id": admin_row[0]})
                        await db.commit()
                        logger.info(f"Admin account created with deposit address: {addr}")
                    except Exception as e:
                        logger.warning(f"Admin created but deposit address failed: {e}")
                        logger.info("Admin account created")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Admin check skipped: {e}")


async def _ensure_deposit_addresses():
    """Generate deposit addresses for any users missing them."""
    import logging
    from app.core.database import async_session
    from sqlalchemy import text

    logger = logging.getLogger(__name__)
    try:
        from app.services.hdwallet import derive_address_only
        async with async_session() as db:
            result = await db.execute(text("SELECT id FROM users WHERE deposit_address IS NULL"))
            rows = result.fetchall()
            if not rows:
                return
            for row in rows:
                try:
                    addr = derive_address_only(row[0])
                    await db.execute(text("UPDATE users SET deposit_address = :a, deposit_hd_index = :idx WHERE id = :id"), {"a": addr, "idx": row[0], "id": row[0]})
                except Exception as e:
                    logger.warning(f"Deposit address failed for user {row[0]}: {e}")
            await db.commit()
            logger.info(f"Generated deposit addresses for {len(rows)} user(s)")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Deposit address generation skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _ensure_admin()
    await _ensure_deposit_addresses()
    # Start background scheduler
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="HashBrotherHood API",
    description="Mining Hashrate Rental Marketplace",
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    lifespan=lifespan,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

# Mount all routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(algorithms.router, prefix="/api/v1")
app.include_router(rigs.router, prefix="/api/v1")
app.include_router(rentals.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(favorites.router, prefix="/api/v1")
app.include_router(disputes.router, prefix="/api/v1")
app.include_router(internal.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"name": "HashBrotherHood API", "version": "1.0.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
