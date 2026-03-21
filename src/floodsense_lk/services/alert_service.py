"""Alert delivery service — dedup, fatigue prevention, Twilio delivery.

Rules:
  - Cooldown key per (station, anomaly_type) — TTL by severity
  - Max 3 alerts per subscriber per 24 hrs (CRITICAL bypasses this cap)
  - All delivery attempts logged to alert_history (no raw PII)
"""

import structlog
from twilio.rest import Client as TwilioClient

from floodsense_lk.config.settings import settings
from floodsense_lk.db import redis_client, timescale

logger = structlog.get_logger(__name__)

_COOLDOWN_TTL = {
    "LOW":      14400,  # 4 hours
    "MEDIUM":   7200,   # 2 hours
    "HIGH":     3600,   # 1 hour
    "CRITICAL": 1800,   # 30 minutes
}

_FATIGUE_LIMIT = 3          # per subscriber per 24 hrs
_FATIGUE_WINDOW_S = 86400   # 24 hours


# ── Deduplication ─────────────────────────────────────────────────────────────

async def should_send_alert(station_name: str, anomaly_type: str, severity: str) -> bool:
    """Return True if this alert hasn't been sent recently (cooldown check)."""
    key = f"alert:cooldown:{station_name}:{anomaly_type}"
    existing = await redis_client.get(key)
    if existing:
        logger.debug("alert_skipped_cooldown", station=station_name, type=anomaly_type)
        return False
    ttl = _COOLDOWN_TTL.get(severity, 3600)
    await redis_client.set(key, "1", ttl)
    return True


# ── Fatigue check ─────────────────────────────────────────────────────────────

async def _alert_count_24h(recipient_hash: str) -> int:
    row = await timescale.fetchrow(
        """
        SELECT COUNT(*) AS n
        FROM alert_history
        WHERE recipient_hash = $1
          AND sent_at > NOW() - INTERVAL '24 hours'
          AND status = 'SENT'
        """,
        recipient_hash,
    )
    return int(row["n"]) if row else 0


async def fatigue_check(recipient_hash: str, severity: str) -> bool:
    """Return True if subscriber can receive another alert (not fatigued)."""
    if severity == "CRITICAL":
        return True  # CRITICAL always bypasses fatigue cap
    count = await _alert_count_24h(recipient_hash)
    return count < _FATIGUE_LIMIT


# ── Delivery log ──────────────────────────────────────────────────────────────

async def _log_delivery(
    anomaly_event_id: int | None,
    channel: str,
    recipient_hash: str,
    status: str,
    language: str,
    provider_id: str | None = None,
    error_message: str | None = None,
) -> None:
    await timescale.execute(
        """
        INSERT INTO alert_history
            (anomaly_event_id, sent_at, channel, recipient_hash,
             status, provider_id, error_message, language)
        VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
        """,
        anomaly_event_id, channel, recipient_hash,
        status, provider_id, error_message, language,
    )


# ── Twilio delivery ───────────────────────────────────────────────────────────

def _twilio_client() -> TwilioClient | None:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        return None
    return TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)


async def send_whatsapp(
    recipient_hash: str,
    phone_number: str,          # actual number — never stored, only used for Twilio call
    message: str,
    anomaly_event_id: int | None,
    language: str = "en",
) -> dict:
    if not settings.enable_whatsapp_alerts:
        logger.debug("whatsapp_disabled", recipient_hash=recipient_hash)
        await _log_delivery(anomaly_event_id, "WHATSAPP", recipient_hash, "SKIPPED_COOLDOWN", language)
        return {"success": False, "reason": "disabled"}

    client = _twilio_client()
    if not client:
        logger.warning("twilio_not_configured")
        return {"success": False, "reason": "twilio_not_configured"}

    try:
        msg = client.messages.create(
            from_=settings.twilio_whatsapp_from,
            to=f"whatsapp:{phone_number}",
            body=message,
        )
        await _log_delivery(anomaly_event_id, "WHATSAPP", recipient_hash, "SENT", language, provider_id=msg.sid)
        logger.info("whatsapp_sent", sid=msg.sid)
        return {"success": True, "provider_id": msg.sid}
    except Exception as exc:
        logger.warning("whatsapp_failed", error=str(exc))
        await _log_delivery(anomaly_event_id, "WHATSAPP", recipient_hash, "FAILED", language, error_message=str(exc))
        return {"success": False, "reason": str(exc)}


async def send_sms(
    recipient_hash: str,
    phone_number: str,
    message: str,
    anomaly_event_id: int | None,
    language: str = "en",
) -> dict:
    if not settings.enable_sms_alerts:
        logger.debug("sms_disabled", recipient_hash=recipient_hash)
        return {"success": False, "reason": "disabled"}

    client = _twilio_client()
    if not client:
        return {"success": False, "reason": "twilio_not_configured"}

    try:
        msg = client.messages.create(
            from_=settings.twilio_whatsapp_from.replace("whatsapp:", ""),
            to=phone_number,
            body=message,
        )
        await _log_delivery(anomaly_event_id, "SMS", recipient_hash, "SENT", language, provider_id=msg.sid)
        logger.info("sms_sent", sid=msg.sid)
        return {"success": True, "provider_id": msg.sid}
    except Exception as exc:
        logger.warning("sms_failed", error=str(exc))
        await _log_delivery(anomaly_event_id, "SMS", recipient_hash, "FAILED", language, error_message=str(exc))
        return {"success": False, "reason": str(exc)}


# ── Subscriber filtering ───────────────────────────────────────────────────────

async def get_matching_subscribers(basin_name: str, station_name: str, severity: str) -> list[dict]:
    """Return active verified subscribers interested in this basin/station/severity.

    encrypted_phone is included so the alert agent can decrypt it at delivery time.
    """
    severity_order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    severity_idx = severity_order.index(severity) if severity in severity_order else 2

    rows = await timescale.fetch(
        """
        SELECT id, phone_hash, email_hash, encrypted_phone, basins, stations,
               min_severity, channels, language
        FROM subscribers
        WHERE active = TRUE AND verified = TRUE
          AND (
              $1 = ANY(basins)
              OR $2 = ANY(stations)
              OR (array_length(basins, 1) = 0 AND array_length(stations, 1) = 0)
          )
        """,
        basin_name,
        station_name,
    )

    results = []
    for row in rows:
        d = dict(row)
        sub_min = severity_order.index(d["min_severity"]) if d["min_severity"] in severity_order else 2
        if severity_idx >= sub_min:
            results.append(d)
    return results
