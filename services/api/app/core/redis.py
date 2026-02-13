import redis.asyncio as redis

from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


async def get_redis():
    return redis_client


async def blacklist_token(token_jti: str, ttl_seconds: int) -> None:
    """Add a token to the blacklist in Redis."""
    await redis_client.setex(f"blacklist:{token_jti}", ttl_seconds, "1")


async def is_token_blacklisted(token_jti: str) -> bool:
    """Check if a token is blacklisted."""
    return await redis_client.exists(f"blacklist:{token_jti}") > 0


async def mark_totp_used(user_id: int, code: str) -> bool:
    """Mark a TOTP code as used. Returns False if already used (replay attack)."""
    key = f"totp_used:{user_id}:{code}"
    # SET with NX returns True if the key was set (code not used before)
    result = await redis_client.set(key, "1", nx=True, ex=90)
    return result is not None
