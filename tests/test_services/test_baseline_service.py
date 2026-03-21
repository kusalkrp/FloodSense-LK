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
    call_args = mock_db["execute"].call_args[0]  # positional args to execute
    # low_confidence is 8th param ($8) in the INSERT — index 7
    assert call_args[7] is True  # low_confidence


async def test_upsert_baseline_stores_values(mock_db):
    from floodsense_lk.services.baseline_service import upsert_baseline
    await upsert_baseline("Hanwella", 12, 2.80, 0.30, 0.06, 0.02, 120)
    mock_db["execute"].assert_called_once()
    args = mock_db["execute"].call_args[0]
    assert args[1] == "Hanwella"
    assert args[2] == 12
    assert args[7] is False  # low_confidence — 120 >= 50
