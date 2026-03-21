"""Subscriber CRUD — PII stored as HMAC-SHA256 hash + AES-256-GCM encrypted value."""

import structlog

from floodsense_lk.core.security import decrypt_pii, encrypt_pii, hash_pii
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
    encrypted_phone = encrypt_pii(phone, settings.phone_encryption_key) if phone else None

    row = await timescale.fetchrow(
        """
        INSERT INTO subscribers
            (phone_hash, email_hash, encrypted_phone, basins, stations, min_severity, channels, language)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (phone_hash) DO UPDATE SET
            encrypted_phone = EXCLUDED.encrypted_phone,
            basins          = EXCLUDED.basins,
            stations        = EXCLUDED.stations,
            min_severity    = EXCLUDED.min_severity,
            channels        = EXCLUDED.channels,
            language        = EXCLUDED.language,
            active          = TRUE
        RETURNING id
        """,
        phone_hash, email_hash, encrypted_phone, basins, stations, min_severity, channels, language,
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


def resolve_phone(encrypted_phone: str | None) -> str | None:
    """Decrypt an encrypted_phone token for Twilio delivery. Returns None if not set.

    Call this only inside alert delivery code — never log the result.
    """
    if not encrypted_phone:
        return None
    return decrypt_pii(encrypted_phone, settings.phone_encryption_key)
