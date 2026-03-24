"""Tests for supervisor agent."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from floodsense_lk.agents.state import FloodSenseState


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


async def test_supervisor_llm_success(mock_db):
    """Supervisor sets intensity from LLM response."""
    mock_db["fetchrow"].return_value = {"routing_decision": "calm_day", "anomalies_found": 0, "alerts_sent": 0}

    mock_response = MagicMock()
    mock_response.content = '{"intensity": "ELEVATED", "reason": "Monsoon active", "focus_basins": []}'

    with patch("floodsense_lk.agents.supervisor.ChatGoogleGenerativeAI") as mock_llm_cls:
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)
        mock_llm_cls.return_value = mock_llm

        from floodsense_lk.agents.supervisor import supervisor_node
        state = _make_state()
        result = await supervisor_node(state)

    assert result["monitoring_intensity"] == "ELEVATED"
    assert result["errors"] == []


async def test_supervisor_llm_failure_falls_back(mock_db):
    """Supervisor falls back to rule-based intensity when LLM fails."""
    mock_db["fetchrow"].return_value = None

    with patch("floodsense_lk.agents.supervisor.ChatGoogleGenerativeAI") as mock_llm_cls:
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(side_effect=Exception("API key invalid"))
        mock_llm_cls.return_value = mock_llm

        from floodsense_lk.agents.supervisor import supervisor_node
        state = _make_state()
        result = await supervisor_node(state)

    # Should fall back — not raise
    assert result["monitoring_intensity"] in ("STANDARD", "ELEVATED", "HIGH_ALERT")
    assert any("supervisor_llm_failed" in e for e in result["errors"])


async def test_supervisor_invalid_llm_intensity_defaults_to_standard(mock_db):
    """Supervisor rejects invalid LLM intensity values."""
    mock_db["fetchrow"].return_value = None

    mock_response = MagicMock()
    mock_response.content = '{"intensity": "MAXIMUM_PANIC", "reason": "test"}'

    with patch("floodsense_lk.agents.supervisor.ChatGoogleGenerativeAI") as mock_llm_cls:
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)
        mock_llm_cls.return_value = mock_llm

        from floodsense_lk.agents.supervisor import supervisor_node
        state = _make_state()
        result = await supervisor_node(state)

    assert result["monitoring_intensity"] == "STANDARD"
