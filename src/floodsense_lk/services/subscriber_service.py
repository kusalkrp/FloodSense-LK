"""Subscriber CRUD — all PII stored as HMAC-SHA256 hash, never in plain text."""

import structlog

from floodsense_lk.core.security import hash_pii
from floodsense_lk.config.settings import settings
from floodsense_lk.db import timescale

logger = structlog.get_logger(__name__)


async def create_subscriber(
    phone: str | None,
    email: str | None,
    basins: list[str],
    stations: list[str],
    min_severity: str,
    channels: list[str],
    language: str,
) -> int:
    phone_hash = hash_pii(phone, settings.alert_salt) if phone else None
    email_hash = hash_pii(email, settings.alert_salt) if email else None

    row = await timescale.fetchrow(
        """
        INSERT INTO subscribers
            (phone_hash, email_hash, basins, stations, min_severity, channels, language)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (phone_hash) DO UPDATE SET
            basins       = EXCLUDED.basins,
            stations     = EXCLUDED.stations,
            min_severity = EXCLUDED.min_severity,
            channels     = EXCLUDED.channels,
            language     = EXCLUDED.language,
            active       = TRUE
        RETURNING id
        """,
        phone_hash, email_hash, basins, stations, min_severity, channels, language,
    )
    return row["id"]


async def verify_subscriber(phone: str) -> bool:
    phone_hash = hash_pii(phone, settings.alert_salt)
    await timescale.execute(
        "UPDATE subscribers SET verified = TRUE WHERE phone_hash = $1",
        phone_hash,
    )
    return True


async def deactivate_subscriber(phone: str) -> bool:
    phone_hash = hash_pii(phone, settings.alert_salt)
    result = await timescale.fetchrow(
        "UPDATE subscribers SET active = FALSE WHERE phone_hash = $1 RETURNING id",
        phone_hash,
    )
    return result is not None


async def get_subscriber_by_phone(phone: str) -> dict | None:
    phone_hash = hash_pii(phone, settings.alert_salt)
    row = await timescale.fetchrow(
        """
        SELECT id, basins, stations, min_severity, channels, language, active, verified
        FROM subscribers WHERE phone_hash = $1
        """,
        phone_hash,
    )
    return dict(row) if row else None
