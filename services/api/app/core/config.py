from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENV: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://hashrent:hashrent_dev@localhost:5433/hashrent"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "dev-secret-key-change-in-production-abc123xyz"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 1
    JWT_REFRESH_EXPIRY_DAYS: int = 7
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:4000", "http://localhost:9000"]
    PLATFORM_FEE_PERCENT: float = 3.0

    # BSC Network
    BSC_RPC_URL: str = "https://bsc-dataseed.binance.org/"
    HOT_WALLET_ADDRESS: str = ""
    HOT_WALLET_PRIVATE_KEY: str = ""

    # Rate limiting
    RATE_LIMIT_LOGIN: int = 5  # per minute
    RATE_LIMIT_REGISTER: int = 3  # per minute
    RATE_LIMIT_DEPOSIT: int = 10  # per minute
    RATE_LIMIT_2FA: int = 5  # per minute

    class Config:
        env_file = ".env"


settings = Settings()

# Production'da default secret key kullanilmasini engelle
if settings.ENV == "production" and settings.SECRET_KEY == "dev-secret-key-change-in-production-abc123xyz":
    raise RuntimeError("SECRET_KEY must be changed in production! Set a strong SECRET_KEY environment variable.")

# Any environment: reject if SECRET_KEY is too short
if len(settings.SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters long.")
