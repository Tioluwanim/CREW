"""Runtime configuration. Read from the environment on every call to get_settings(),
so tests and deployments can change env vars without re-importing modules."""
import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def _bool(name: str, default: bool = False) -> bool:
    return _env(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _origins() -> tuple[str, ...]:
    raw = _env("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
    return tuple(o.strip() for o in raw.split(",") if o.strip())


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", "sqlite:///./crew.db"))
    jwt_secret: str = field(default_factory=lambda: _env("JWT_SECRET", "dev-only-change-me"))
    jwt_ttl_minutes: int = field(default_factory=lambda: int(_env("JWT_TTL_MINUTES", "1440")))
    cors_origins: tuple[str, ...] = field(default_factory=_origins)
    public_app_url: str = field(default_factory=lambda: _env("PUBLIC_APP_URL", "http://localhost:3000"))
    demo_mode: bool = field(default_factory=lambda: _bool("CREW_DEMO_MODE"))
    payment_provider: str = field(default_factory=lambda: _env("PAYMENT_PROVIDER", "sandbox"))  # sandbox | ecobank
    payout_provider: str = field(default_factory=lambda: _env("PAYOUT_PROVIDER"))  # empty = same as PAYMENT_PROVIDER
    webhook_secret: str = field(default_factory=lambda: _env("WEBHOOK_SECRET", "dev-webhook-secret"))
    ecobank_base_url: str = field(default_factory=lambda: _env("ECOBANK_BASE_URL"))
    ecobank_client_id: str = field(default_factory=lambda: _env("ECOBANK_CLIENT_ID"))
    ecobank_client_secret: str = field(default_factory=lambda: _env("ECOBANK_CLIENT_SECRET"))
    forecaster: str = field(default_factory=lambda: _env("FORECASTER", "baseline"))
    agent: str = field(default_factory=lambda: _env("AGENT_RUNTIME", "null"))
    smtp_host: str = field(default_factory=lambda: _env("SMTP_HOST"))  # empty = console fallback (messages marked `logged`)
    smtp_port: int = field(default_factory=lambda: int(_env("SMTP_PORT", "587")))
    smtp_user: str = field(default_factory=lambda: _env("SMTP_USER"))
    smtp_password: str = field(default_factory=lambda: _env("SMTP_PASSWORD"))
    smtp_from: str = field(default_factory=lambda: _env("SMTP_FROM"))
    smtp_starttls: bool = field(default_factory=lambda: _bool("SMTP_STARTTLS", True))
    cron_secret: str = field(default_factory=lambda: _env("CRON_SECRET"))  # empty = sweep endpoint disabled
    env: str = field(default_factory=lambda: _env("CREW_ENV", "development"))  # development | production
    demo_auto_auth: bool = field(default_factory=lambda: _bool("DEMO_AUTO_AUTH"))  # dev only: no header -> demo user
    auto_create_tables: bool = field(default_factory=lambda: _bool("AUTO_CREATE_TABLES", True))  # False when using Alembic


def get_settings() -> Settings:
    return Settings()


def assert_production_safe(s: Settings) -> None:
    """Refuse to boot in production with dev defaults or demo shortcuts."""
    if s.env != "production":
        return
    problems = []
    if s.jwt_secret in ("", "dev-only-change-me") or len(s.jwt_secret) < 32:
        problems.append("JWT_SECRET must be set to a random value of at least 32 characters")
    if s.webhook_secret in ("", "dev-webhook-secret") or len(s.webhook_secret) < 16:
        problems.append("WEBHOOK_SECRET must be set to a random value of at least 16 characters")
    if s.demo_mode or s.demo_auto_auth:
        problems.append("CREW_DEMO_MODE and DEMO_AUTO_AUTH must be off")
    if s.database_url.startswith("sqlite"):
        problems.append("DATABASE_URL must point at PostgreSQL")
    if problems:
        raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))
