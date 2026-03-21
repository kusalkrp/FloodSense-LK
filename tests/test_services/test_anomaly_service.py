"""Tests for anomaly_service.py — all pure logic, no DB/MCP."""

import pytest
from unittest.mock import AsyncMock, patch

from floodsense_lk.services.anomaly_service import (
    compute_z_score,
    detect_level_anomaly,
    detect_rate_spike,
    detect_upstream_propagation,
    compute_basin_compound_score,
    KELANI_CORRIDOR,
)
from tests.fixtures.sample_data import SAMPLE_BASELINE


# ── Z-score ────────────────────────────────────────────────────────────────────

async def test_compute_z_score_normal():
    baseline = {**SAMPLE_BASELINE, "avg_level_m": 2.80, "stddev_level_m": 0.30}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        z = await compute_z_score("Hanwella", 2.80, 12)
    assert z == 0.0


async def test_compute_z_score_high():
    baseline = {**SAMPLE_BASELINE, "avg_level_m": 2.80, "stddev_level_m": 0.30}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        z = await compute_z_score("Hanwella", 3.85, 12)  # 1.05 above avg, stddev 0.30 → z=3.5
    assert z == pytest.approx(3.5, rel=0.01)


async def test_compute_z_score_no_baseline():
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=None):
        z = await compute_z_score("Unknown", 5.0, 12)
    assert z == 0.0


async def test_compute_z_score_zero_stddev():
    baseline = {**SAMPLE_BASELINE, "avg_level_m": 2.80, "stddev_level_m": 0.0}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        z = await compute_z_score("Hanwella", 5.0, 12)
    assert z == 0.0


# ── Level anomaly ──────────────────────────────────────────────────────────────

async def test_detect_level_anomaly_critical():
    baseline = {**SAMPLE_BASELINE, "avg_level_m": 2.0, "stddev_level_m": 0.25}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        signal = await detect_level_anomaly("Hanwella", 3.1, 12)  # z = (3.1-2.0)/0.25 = 4.4
    assert signal is not None
    assert signal.severity == "CRITICAL"
    assert signal.z_score > 4.0


async def test_detect_level_anomaly_none_below_threshold():
    baseline = {**SAMPLE_BASELINE, "avg_level_m": 2.80, "stddev_level_m": 0.30}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        signal = await detect_level_anomaly("Hanwella", 2.90, 12)  # z = 0.33 — below 2.0
    assert signal is None


# ── Rate spike ─────────────────────────────────────────────────────────────────

async def test_detect_rate_spike_above_threshold():
    baseline = {**SAMPLE_BASELINE, "avg_rate_m_per_hr": 0.06}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        signal = await detect_rate_spike("Hanwella", 0.18, 12)  # ratio = 3.0
    assert signal is not None
    assert signal.severity == "HIGH"
    assert signal.rate_spike_ratio == pytest.approx(3.0)


async def test_detect_rate_spike_below_threshold():
    baseline = {**SAMPLE_BASELINE, "avg_rate_m_per_hr": 0.06}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        signal = await detect_rate_spike("Hanwella", 0.08, 12)  # ratio = 1.33 — below 2.0
    assert signal is None


async def test_detect_rate_spike_critical():
    baseline = {**SAMPLE_BASELINE, "avg_rate_m_per_hr": 0.04}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        signal = await detect_rate_spike("Hanwella", 0.25, 12)  # ratio = 6.25
    assert signal is not None
    assert signal.severity == "CRITICAL"


async def test_detect_rate_spike_zero_rate():
    baseline = {**SAMPLE_BASELINE, "avg_rate_m_per_hr": 0.06}
    with patch("floodsense_lk.services.anomaly_service.get_baseline", new_callable=AsyncMock, return_value=baseline):
        signal = await detect_rate_spike("Hanwella", 0.0, 12)
    assert signal is None


# ── Kelani corridor propagation ────────────────────────────────────────────────

def test_detect_upstream_propagation_triggers():
    corridor = [
        {"station_name": "Norwood", "rate_of_rise": 0.20},      # above 0.15 threshold
        {"station_name": "Kithulgala", "rate_of_rise": 0.05},
        {"station_name": "Deraniyagala", "rate_of_rise": 0.02},
        {"station_name": "Glencourse", "rate_of_rise": 0.0},
        {"station_name": "Holombuwa", "rate_of_rise": 0.0},
        {"station_name": "Hanwella", "rate_of_rise": 0.0},
        {"station_name": "Nagalagam Street", "rate_of_rise": 0.0},
    ]
    warnings = detect_upstream_propagation(corridor)
    assert len(warnings) > 0
    # Norwood (eta=5h) → Kithulgala (eta=4h) → delta = 1h
    assert any(w["source_station"] == "Norwood" for w in warnings)
    assert any(w["affected_station"] == "Nagalagam Street" for w in warnings)


def test_detect_upstream_propagation_no_trigger():
    corridor = [
        {"station_name": s, "rate_of_rise": 0.05}
        for s, _ in KELANI_CORRIDOR
    ]
    warnings = detect_upstream_propagation(corridor)
    assert warnings == []


def test_detect_upstream_propagation_eta_severity():
    corridor = [
        {"station_name": "Hanwella", "rate_of_rise": 0.20},
        {"station_name": "Nagalagam Street", "rate_of_rise": 0.0},
    ]
    warnings = detect_upstream_propagation(corridor)
    # Hanwella → Nagalagam Street: eta = 1.0 - 0.0 = 1.0h → HIGH
    assert any(w["severity"] == "HIGH" and w["eta_hours"] < 2 for w in warnings)


# ── Compound basin score ───────────────────────────────────────────────────────

def test_compound_score_multiple_stations():
    rising = [
        {"station_name": "Hanwella", "basin_name": "Kelani Ganga", "rate_of_rise": 0.18},
        {"station_name": "Glencourse", "basin_name": "Kelani Ganga", "rate_of_rise": 0.20},
        {"station_name": "Holombuwa", "basin_name": "Kelani Ganga", "rate_of_rise": 0.15},
    ]
    score = compute_basin_compound_score("Kelani Ganga", rising)
    # 3 stations → multiplier=2.0, avg_rate≈0.177, score = 0.177*2.0*10 ≈ 3.54
    assert score > 0
    assert score <= 10.0


def test_compound_score_different_basin():
    rising = [{"station_name": "Hanwella", "basin_name": "Kelani Ganga", "rate_of_rise": 0.18}]
    score = compute_basin_compound_score("Kalu Ganga", rising)
    assert score == 0.0


def test_compound_score_empty():
    assert compute_basin_compound_score("Kelani Ganga", []) == 0.0
