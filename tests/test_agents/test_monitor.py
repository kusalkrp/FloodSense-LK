"""Tests for monitor agent."""

import pytest
from unittest.mock import AsyncMock, patch

from floodsense_lk.agents.state import FloodSenseState
from tests.fixtures.sample_data import SAMPLE_STATION, SAMPLE_RISING_STATION


def _make_state(**overrides) -> FloodSenseState:
    base: FloodSenseState = {
        "run_id": "test-001",
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


async def test_monitor_populates_state():
    """Monitor correctly parses MCP response into state fields."""
    mcp_responses = {
        "get_all_current_levels": {"stations": [SAMPLE_STATION, SAMPLE_RISING_STATION]},
        "get_rising_stations":    {"stations": [SAMPLE_RISING_STATION]},
        "get_alert_stations":     {"stations": [SAMPLE_RISING_STATION]},
        "get_kelani_corridor":    {"stations": []},
        "get_all_basins_summary": {"basins": []},
    }

    async def fake_safe_call(base_url, tool_name, args=None):
        return mcp_responses.get(tool_name)

    with patch("floodsense_lk.agents.monitor.safe_call", side_effect=fake_safe_call):
        from floodsense_lk.agents.monitor import monitor_node
        state = _make_state()
        result = await monitor_node(state)

    assert len(result["station_snapshots"]) == 2
    assert len(result["rising_stations"]) == 1
    assert len(result["alert_stations"]) == 1
    assert result["rising_stations"][0]["station_name"] == "Glencourse"


async def test_monitor_handles_mcp_failure_gracefully():
    """Monitor records errors but does not raise when MCP calls fail."""
    async def fake_safe_call(base_url, tool_name, args=None):
        return None  # all calls fail

    with patch("floodsense_lk.agents.monitor.safe_call", side_effect=fake_safe_call):
        from floodsense_lk.agents.monitor import monitor_node
        state = _make_state()
        result = await monitor_node(state)

    assert result["station_snapshots"] == []
    assert any("mcp_get_all_current_levels_failed" in e for e in result["errors"])


async def test_monitor_flags_stale_stations():
    """Stations older than 45 minutes are flagged as stale."""
    stale_station = {**SAMPLE_STATION, "data_age_minutes": 60}

    async def fake_safe_call(base_url, tool_name, args=None):
        if tool_name == "get_all_current_levels":
            return {"stations": [stale_station]}
        return {"stations": []}

    with patch("floodsense_lk.agents.monitor.safe_call", side_effect=fake_safe_call):
        from floodsense_lk.agents.monitor import monitor_node
        state = _make_state()
        result = await monitor_node(state)

    assert result["station_snapshots"][0]["is_stale"] is True
    assert any("stale_data" in e for e in result["errors"])


async def test_monitor_fresh_stations_not_stale():
    """Stations within 45 minutes are not flagged as stale."""
    async def fake_safe_call(base_url, tool_name, args=None):
        if tool_name == "get_all_current_levels":
            return {"stations": [SAMPLE_STATION]}
        return {"stations": []}

    with patch("floodsense_lk.agents.monitor.safe_call", side_effect=fake_safe_call):
        from floodsense_lk.agents.monitor import monitor_node
        state = _make_state()
        result = await monitor_node(state)

    assert result["station_snapshots"][0]["is_stale"] is False
