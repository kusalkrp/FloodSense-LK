"""Tests for alert_service.py — dedup, fatigue, subscriber filtering."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ── Cooldown dedup ─────────────────────────────────────────────────────────────

async def test_should_send_alert_first_time(mock_redis):
    from floodsense_lk.services.alert_service import should_send_alert
    result = await should_send_alert("Hanwella", "RATE_SPIKE", "HIGH")
    assert result is True
    assert "alert:cooldown:Hanwella:RATE_SPIKE" in mock_redis


async def test_should_send_alert_blocked_by_cooldown(mock_redis):
    from floodsense_lk.services.alert_service import should_send_alert
    mock_redis["alert:cooldown:Hanwella:RATE_SPIKE"] = "1"
    result = await should_send_alert("Hanwella", "RATE_SPIKE", "HIGH")
    assert result is False


async def test_cooldown_ttl_varies_by_severity(mock_redis):
    from floodsense_lk.services.alert_service import should_send_alert, _COOLDOWN_TTL
    assert _COOLDOWN_TTL["CRITICAL"] < _COOLDOWN_TTL["LOW"]
    assert _COOLDOWN_TTL["HIGH"] < _COOLDOWN_TTL["MEDIUM"]


# ── Fatigue prevention ─────────────────────────────────────────────────────────

async def test_fatigue_check_under_limit(mock_db):
    mock_db["fetchrow"].return_value = {"n": 1}
    from floodsense_lk.services.alert_service import fatigue_check
    result = await fatigue_check("hashed_recipient", "HIGH")
    assert result is True


async def test_fatigue_check_at_limit(mock_db):
    mock_db["fetchrow"].return_value = {"n": 3}
    from floodsense_lk.services.alert_service import fatigue_check
    result = await fatigue_check("hashed_recipient", "HIGH")
    assert result is False


async def test_fatigue_check_critical_bypasses(mock_db):
    mock_db["fetchrow"].return_value = {"n": 10}
    from floodsense_lk.services.alert_service import fatigue_check
    result = await fatigue_check("hashed_recipient", "CRITICAL")
    assert result is True  # CRITICAL always bypasses


# ── Subscriber filtering ───────────────────────────────────────────────────────

async def test_get_matching_subscribers_by_severity(mock_db):
    mock_db["fetch"].return_value = [
        {"id": 1, "phone_hash": "abc", "email_hash": None,
         "basins": ["Kelani Ganga"], "stations": [],
         "min_severity": "HIGH", "channels": ["WHATSAPP"], "language": "en"},
        {"id": 2, "phone_hash": "def", "email_hash": None,
         "basins": ["Kelani Ganga"], "stations": [],
         "min_severity": "CRITICAL", "channels": ["SMS"], "language": "si"},
    ]
    from floodsense_lk.services.alert_service import get_matching_subscribers
    # Severity HIGH — subscriber 1 (min HIGH) matches, subscriber 2 (min CRITICAL) does not
    results = await get_matching_subscribers("Kelani Ganga", "Hanwella", "HIGH")
    assert len(results) == 1
    assert results[0]["id"] == 1


async def test_get_matching_subscribers_critical_matches_all(mock_db):
    mock_db["fetch"].return_value = [
        {"id": 1, "phone_hash": "abc", "email_hash": None,
         "basins": ["Kelani Ganga"], "stations": [],
         "min_severity": "LOW", "channels": ["WHATSAPP"], "language": "en"},
        {"id": 2, "phone_hash": "def", "email_hash": None,
         "basins": ["Kelani Ganga"], "stations": [],
         "min_severity": "CRITICAL", "channels": ["SMS"], "language": "si"},
    ]
    from floodsense_lk.services.alert_service import get_matching_subscribers
    results = await get_matching_subscribers("Kelani Ganga", "Hanwella", "CRITICAL")
    assert len(results) == 2


# ── Delivery disabled by default ───────────────────────────────────────────────

async def test_send_whatsapp_disabled_by_default(mock_db):
    from floodsense_lk.services.alert_service import send_whatsapp
    result = await send_whatsapp("hash_abc", "+94771234567", "Test message", None)
    assert result["success"] is False
    assert result["reason"] == "disabled"


async def test_send_sms_disabled_by_default(mock_db):
    from floodsense_lk.services.alert_service import send_sms
    result = await send_sms("hash_abc", "+94771234567", "Test message", None)
    assert result["success"] is False
    assert result["reason"] == "disabled"
