import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    app_name: str = os.getenv("APP_NAME", "Client Management System API")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    app_secret: str = os.getenv("APP_SECRET", "change-me")
    session_ttl_hours: int = int(os.getenv("SESSION_TTL_HOURS", "72"))
    session_secure: bool = (
        os.getenv("SESSION_SECURE", "false").lower() == "true"
        if os.getenv("APP_ENV", "development") == "production"
        else False
    )
    allowed_origins: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    enable_docs: bool = os.getenv("ENABLE_DOCS", "true").lower() == "true"
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "20"))
    login_rate_limit_attempts: int = int(os.getenv("LOGIN_RATE_LIMIT_ATTEMPTS", "10"))
    login_rate_limit_window_seconds: int = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "900"))
    smtp_host: str | None = os.getenv("SMTP_HOST") or None
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: str | None = os.getenv("SMTP_USERNAME") or None
    smtp_password: str | None = os.getenv("SMTP_PASSWORD") or None
    smtp_from: str = os.getenv("SMTP_FROM", "hello@localhost")
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

settings = Settings()
