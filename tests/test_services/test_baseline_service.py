"""Tests for baseline_service.py."""

import pytest
from unittest.mock import AsyncMock, patch

from tests.fixtures.sample_data import SAMPLE_BASELINE


async def test_get_baseline_returns_dict(mock_db):
    mock_db["fetchrow"].return_value = SAMPLE_BASELINE
    from floodsense_lk.services.baseline_service import get_baseline
    result = await get_baseline("Hanwella", 12)
    assert result is not None
    assert result["avg_level_m"] == 2.80


async def test_get_baseline_returns_none_when_missing(mock_db):
    mock_db["fetchrow"].return_value = None
    from floodsense_lk.services.baseline_service import get_baseline
    result = await get_baseline("Unknown Station", 12)
    assert result is None


async def test_compute_baseline_from_history_sufficient_data(mock_db):
    history = [{"water_level_m": 2.5 + i * 0.01, "rate_of_rise": 0.05} for i in range(60)]
    from floodsense_lk.services.baseline_service import compute_baseline_from_history
    await compute_baseline_from_history("Hanwella", 12, history)
    mock_db["execute"].assert_called_once()


async def test_compute_baseline_from_history_empty(mock_db):
    from floodsense_lk.services.baseline_service import compute_baseline_from_history
    await compute_baseline_from_history("Hanwella", 12, [])
    mock_db["execute"].assert_not_called()


async def test_low_confidence_flag_below_50_samples(mock_db):
    """Baselines with < 50 samples should set low_confidence = True."""
    history = [{"water_level_m": 2.5, "rate_of_rise": 0.05} for _ in range(20)]
    from floodsense_lk.services.baseline_service import compute_baseline_from_history
    await compute_baseline_from_history("Hanwella", 12, history)
    # Verify upsert_baseline was called with low_confidence=True (sample_count=20 < 50)
    call_kwargs = mock_db["execute"].call_args
    # low_confidence is passed as the 8th positional arg (index 7, 0-based after SQL string)
    # SQL + station, week, avg, stddev, rate, stddev_rate, sample_count, low_confidence
    args = call_kwargs[0]  # positional args tuple
    low_confidence = args[7]  # index: 0=sql, 1=station, 2=week, 3=avg, 4=stddev, 5=rate, 6=stddev_rate, 7=sample_count, 8=low_confidence
    # Actually check via the logger output: low_confidence=True was logged
    # Better: verify execute was called and sample_count=20 triggers low_confidence
    assert mock_db["execute"].called
    # sample_count arg is at index 7 (after sql string) — 20 < 50 so low_confidence should be True
    assert args[8] is True  # low_confidence at index 8


async def test_upsert_baseline_stores_values(mock_db):
    from floodsense_lk.services.baseline_service import upsert_baseline
    await upsert_baseline("Hanwella", 12, 2.80, 0.30, 0.06, 0.02, 120)
    mock_db["execute"].assert_called_once()
    args = mock_db["execute"].call_args[0]
    # args: sql, station_name, week_of_year, avg_level_m, stddev_level_m, avg_rate, stddev_rate, sample_count, low_confidence
    assert args[1] == "Hanwella"
    assert args[2] == 12
    assert args[8] is False  # low_confidence — 120 >= 50
