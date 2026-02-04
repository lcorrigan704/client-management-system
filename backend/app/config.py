import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Client Management System API")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    app_secret: str = os.getenv("APP_SECRET", "change-me")
    session_ttl_hours: int = int(os.getenv("SESSION_TTL_HOURS", "72"))
    session_secure: bool = os.getenv("SESSION_SECURE", "false").lower() == "true"
    allowed_origins: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    smtp_host: str | None = os.getenv("SMTP_HOST") or None
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: str | None = os.getenv("SMTP_USERNAME") or None
    smtp_password: str | None = os.getenv("SMTP_PASSWORD") or None
    smtp_from: str = os.getenv("SMTP_FROM", "hello@localhost")
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

settings = Settings()
