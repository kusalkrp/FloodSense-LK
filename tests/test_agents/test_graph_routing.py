"""Tests for LangGraph conditional routing logic."""

import pytest
from floodsense_lk.agents.graph import after_monitor_router
from floodsense_lk.agents.state import FloodSenseState


def _make_state(**overrides) -> FloodSenseState:
    base: FloodSenseState = {
        "run_id": "test",
        "triggered_at": "2026-03-21T10:00:00+05:30",
        "monitoring_intensity": "STANDARD",
        "station_snapshots": [],
        "rising_stations": [],
        "alert_stations": [],
        "anomalies_detected": [],
        "risk_assessments": [],
        "alerts_to_send": [],
        "alerts_sent": [],
        "report_summary": "",
        "errors": [],
    }
    return {**base, **overrides}


# ── after_monitor_router ───────────────────────────────────────────────────────

def test_after_monitor_calm_day():
    state = _make_state(rising_stations=[], alert_stations=[])
    assert after_monitor_router(state) == "report_only"


def test_after_monitor_rising_triggers_anomaly():
    state = _make_state(
        rising_stations=[{"station_name": "Hanwella", "rate_of_rise": 0.2}],
        alert_stations=[],
    )
    assert after_monitor_router(state) == "run_anomaly"


def test_after_monitor_alert_stations_triggers_anomaly():
    state = _make_state(
        rising_stations=[],
        alert_stations=[{"station_name": "Glencourse", "alert_level": "ALERT"}],
    )
    assert after_monitor_router(state) == "run_anomaly"


def test_after_monitor_both_present_triggers_anomaly():
    state = _make_state(
        rising_stations=[{"station_name": "Hanwella"}],
        alert_stations=[{"station_name": "Glencourse"}],
    )
    assert after_monitor_router(state) == "run_anomaly"
