"""Baseline service — per-station per-ISO-week historical averages.

Baselines are stored in the station_baselines table and recomputed weekly.
NOTE: This service queries the FloodSense own DB (anomaly history etc),
      but cannot query mcp-lk-river-intel's measurements table directly.
      Baseline computation uses get_station_history via MCP to pull data.
"""

import asyncio
import structlog

from floodsense_lk.db import timescale

logger = structlog.get_logger(__name__)

_MIN_SAMPLE_COUNT = 50


async def get_baseline(station_name: str, week_of_year: int) -> dict | None:
    """Return baseline row for (station, week) or None if not computed yet."""
    row = await timescale.fetchrow(
        """
        SELECT station_name, week_of_year, avg_level_m, stddev_level_m,
               avg_rate_m_per_hr, stddev_rate, sample_count, low_confidence
        FROM station_baselines
        WHERE station_name = $1 AND week_of_year = $2
        """,
        station_name,
        week_of_year,
    )
    if row is None:
        return None
    return dict(row)


async def upsert_baseline(
    station_name: str,
    week_of_year: int,
    avg_level_m: float | None,
    stddev_level_m: float | None,
    avg_rate_m_per_hr: float | None,
    stddev_rate: float | None,
    sample_count: int,
) -> None:
    low_confidence = sample_count < _MIN_SAMPLE_COUNT
    await timescale.execute(
        """
        INSERT INTO station_baselines
            (station_name, week_of_year, avg_level_m, stddev_level_m,
             avg_rate_m_per_hr, stddev_rate, sample_count, low_confidence, computed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (station_name, week_of_year) DO UPDATE SET
            avg_level_m      = EXCLUDED.avg_level_m,
            stddev_level_m   = EXCLUDED.stddev_level_m,
            avg_rate_m_per_hr= EXCLUDED.avg_rate_m_per_hr,
            stddev_rate      = EXCLUDED.stddev_rate,
            sample_count     = EXCLUDED.sample_count,
            low_confidence   = EXCLUDED.low_confidence,
            computed_at      = NOW()
        """,
        station_name, week_of_year, avg_level_m, stddev_level_m,
        avg_rate_m_per_hr, stddev_rate, sample_count,
        low_confidence,
    )
    logger.info(
        "baseline_upserted",
        station=station_name,
        week=week_of_year,
        samples=sample_count,
        low_confidence=low_confidence,
    )


async def compute_baseline_from_history(
    station_name: str,
    week_of_year: int,
    history: list[dict],
) -> None:
    """Compute and store a baseline from a list of historical measurement dicts.

    Each dict must have: water_level_m (float), rate_of_rise (float | None).
    Called by the weekly recompute job using MCP get_station_history data.
    """
    levels = [r["water_level_m"] for r in history if r.get("water_level_m") is not None]
    rates = [r["rate_of_rise"] for r in history if r.get("rate_of_rise") is not None]

    n = len(levels)
    if n == 0:
        logger.warning("baseline_no_data", station=station_name, week=week_of_year)
        return

    avg_level = sum(levels) / n
    variance_level = sum((x - avg_level) ** 2 for x in levels) / n
    stddev_level = variance_level ** 0.5

    avg_rate: float | None = None
    stddev_rate: float | None = None
    if rates:
        avg_rate = sum(rates) / len(rates)
        variance_rate = sum((x - avg_rate) ** 2 for x in rates) / len(rates)
        stddev_rate = variance_rate ** 0.5

    await upsert_baseline(
        station_name, week_of_year,
        round(avg_level, 4),
        round(stddev_level, 4),
        round(avg_rate, 4) if avg_rate is not None else None,
        round(stddev_rate, 4) if stddev_rate is not None else None,
        n,
    )
