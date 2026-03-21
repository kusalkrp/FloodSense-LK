"""Tests for LangGraph conditional routing logic."""

import pytest
from floodsense_lk.agents.graph import after_monitor_router, after_risk_router
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


# ── after_risk_router ──────────────────────────────────────────────────────────

def test_after_risk_no_high_risk():
    state = _make_state(risk_assessments=[
        {"station": "Hanwella", "risk_score": 45, "should_alert": False},
        {"station": "Glencourse", "risk_score": 30, "should_alert": False},
    ])
    assert after_risk_router(state) == "report_only"


def test_after_risk_one_above_threshold():
    state = _make_state(risk_assessments=[
        {"station": "Hanwella", "risk_score": 72, "should_alert": True},
        {"station": "Glencourse", "risk_score": 30, "should_alert": False},
    ])
    assert after_risk_router(state) == "run_alerts"


def test_after_risk_exactly_at_threshold():
    state = _make_state(risk_assessments=[
        {"station": "Hanwella", "risk_score": 61, "should_alert": True},
    ])
    assert after_risk_router(state) == "run_alerts"


def test_after_risk_just_below_threshold():
    state = _make_state(risk_assessments=[
        {"station": "Hanwella", "risk_score": 60, "should_alert": False},
    ])
    assert after_risk_router(state) == "report_only"


def test_after_risk_empty_assessments():
    state = _make_state(risk_assessments=[])
    assert after_risk_router(state) == "report_only"
