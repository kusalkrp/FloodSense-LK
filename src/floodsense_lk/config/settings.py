"""Application settings loaded from environment via pydantic-settings."""

import logging
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_log = logging.getLogger(__name__)

_DEFAULT_DSN = "postgresql+asyncpg://floodsense_user:changeme@localhost:5433/floodsense_lk"


class Settings(BaseSettings):
    # Database
    postgres_dsn: str = Field(default=_DEFAULT_DSN)

    # Redis
    redis_url: str = Field(default="redis://localhost:6380")

    # MCP server
    mcp_server_url: str = Field(default="http://localhost:8765")

    # LLM — single model for all agents
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-2.5-flash-preview-04-17")
    gemini_temperature: float = Field(default=0.1)
    gemini_max_tokens: int = Field(default=1024)

    # Security
    admin_api_key: str = Field(default="")

    # Pipeline
    pipeline_interval_seconds: int = Field(default=1800)
    baseline_recompute_day: str = Field(default="sunday")

    # App
    app_host: str = Field(default="0.0.0.0")
    app_port: int = Field(default=8002)
    log_level: str = Field(default="INFO")

    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def warn_insecure_defaults(self) -> "Settings":
        if "changeme" in self.postgres_dsn:
            _log.warning("SECURITY WARNING: default DB password in use — set POSTGRES_DSN in .env.local")
        if not self.admin_api_key:
            _log.warning("SECURITY WARNING: ADMIN_API_KEY not set — /admin routes unprotected")
        return self


settings = Settings()
