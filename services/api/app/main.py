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
    """Ensure admin account exists with correct password on startup."""
    import logging
    from app.core.database import async_session
    from app.core.security import hash_password, verify_password
    from sqlalchemy import text

    logger = logging.getLogger(__name__)
    default_pw = "Admin123!"

    try:
        async with async_session() as db:
            result = await db.execute(text("SELECT id, password_hash FROM users WHERE email = 'admin@hashbrotherhood.com'"))
            row = result.fetchone()
            if row:
                if not verify_password(default_pw, row[1]):
                    new_hash = hash_password(default_pw)
                    await db.execute(text("UPDATE users SET password_hash = :h WHERE id = :id"), {"h": new_hash, "id": row[0]})
                    await db.commit()
                    logger.info("Admin password hash re-synced")
            else:
                new_hash = hash_password(default_pw)
                await db.execute(text(
                    "INSERT INTO users (email, username, password_hash, role, is_active, is_verified) "
                    "VALUES ('admin@hashbrotherhood.com', 'admin', :h, 'admin', true, true)"
                ), {"h": new_hash})
                await db.commit()
                logger.info("Admin account created")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Admin check skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _ensure_admin()
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
