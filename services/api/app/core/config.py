from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://hashrent:hashrent_dev@localhost:5433/hashrent"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "dev-secret-key-change-in-production-abc123xyz"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    JWT_REFRESH_EXPIRY_DAYS: int = 30
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:4000", "http://localhost:9000"]
    PLATFORM_FEE_PERCENT: float = 3.0

    # BSC Network
    BSC_RPC_URL: str = "https://bsc-dataseed.binance.org/"
    HOT_WALLET_ADDRESS: str = ""
    HOT_WALLET_PRIVATE_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
