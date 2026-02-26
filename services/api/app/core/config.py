from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://hashrent:hashrent_dev@localhost:5433/hashrent"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "dev-secret-key-change-in-production-abc123xyz"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 1
    JWT_REFRESH_EXPIRY_DAYS: int = 7
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:4000", "http://localhost:9000"]
    ADMIN_DEFAULT_PASSWORD: str = "Admin123!"  # Override in production via env var
    PLATFORM_FEE_PERCENT: float = 3.0  # Owner fee: deducted from escrow on release
    RENTER_FEE_PERCENT: float = 3.0    # Renter fee: added on top of rental cost

    # LTC Network
    LTC_NETWORK: str = "testnet"  # "mainnet" or "testnet"
    LTC_RPC_URL: str = "http://localhost:9332"  # Litecoin node JSON-RPC endpoint
    LTC_RPC_USER: str = ""
    LTC_RPC_PASSWORD: str = ""
    HOT_WALLET_ADDRESS: str = ""  # ltc1... or L... format
    HOT_WALLET_PRIVATE_KEY: str = ""  # LTC WIF format
    HD_WALLET_MNEMONIC: str = ""  # BIP39 mnemonic for generating user deposit addresses
    DEPOSIT_MIN_CONFIRMATIONS: int = 3   # MRR standard: 3 confirmations to credit balance
    SWEEP_MIN_CONFIRMATIONS: int = 6     # 6 confirmations before sweeping to hot wallet
    SWEEP_MIN_LTC: float = 1.0           # Minimum LTC in address before sweeping
    SWEEP_ENABLED: bool = True

    # Rate limiting
    RATE_LIMIT_LOGIN: int = 5  # per minute
    RATE_LIMIT_REGISTER: int = 3  # per minute
    RATE_LIMIT_DEPOSIT: int = 10  # per minute
    RATE_LIMIT_2FA: int = 5  # per minute

    # BlockCypher API token (optional, free at blockcypher.com — increases rate limit)
    BLOCKCYPHER_TOKEN: str = ""

    # Internal services
    INTERNAL_API_KEY: str = "internal-secret-key-change-in-production-xyz789"  # For stratum proxy → API communication

    # Stratum Proxy — shown to rig owners so they can connect their miners
    STRATUM_HOST: str = "stratum.hashbrotherhood.com"
    STRATUM_BASE_PORT: int = 3333  # Each algorithm gets a port range



settings = Settings()

# Production'da default secret key kullanilmasini engelle
if settings.ENV == "production" and settings.SECRET_KEY == "dev-secret-key-change-in-production-abc123xyz":
    raise RuntimeError("SECRET_KEY must be changed in production! Set a strong SECRET_KEY environment variable.")

# Any environment: reject if SECRET_KEY is too short
if len(settings.SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters long.")
