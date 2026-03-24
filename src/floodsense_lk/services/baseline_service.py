"""Baseline service — per-station per-ISO-week historical averages.

Baselines are stored in the station_baselines table and recomputed weekly.
NOTE: This service queries the FloodSense own DB (anomaly history etc),
      but cannot query mcp-lk-river-intel's measurements table directly.
      Baseline computation uses get_station_history via MCP to pull data.
"""

import asyncio
from datetime import datetime

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


async def bootstrap_all_baselines(mcp_base_url: str) -> dict:
    """One-time bootstrap: pull 7 days of MCP history per station and compute baselines.

    Designed to be triggered once via the admin API when the station_baselines
    table is empty and the weekly recompute job hasn't run yet.
    """
    from floodsense_lk.mcp.client import safe_call

    # list_stations() returns {"stations_by_basin": {basin: [names]}, ...}
    station_list_data = await safe_call(mcp_base_url, "list_stations", {})
    if not station_list_data or "stations_by_basin" not in station_list_data:
        return {"error": "could not fetch station list from MCP"}

    all_station_names: list[str] = []
    for names in station_list_data["stations_by_basin"].values():
        all_station_names.extend(names)

    baselines_computed = 0
    skipped = 0

    for station_name in all_station_names:
        history_data = await safe_call(
            mcp_base_url,
            "get_station_history",
            {"station_name": station_name, "hours": 168},
        )
        if not history_data:
            logger.warning("bootstrap_no_history", station=station_name)
            skipped += 1
            continue

        readings_raw = history_data.get("readings", [])
        if not readings_raw:
            skipped += 1
            continue

        # Group readings by ISO week; normalise MCP key names
        week_groups: dict[int, list[dict]] = {}
        for r in readings_raw:
            ts = r.get("measured_at") or r.get("timestamp")
            if not ts:
                continue
            try:
                dt = datetime.fromisoformat(ts)
            except (ValueError, TypeError):
                continue
            week = dt.isocalendar().week
            week_groups.setdefault(week, []).append({
                "water_level_m": r.get("water_level_m") or r.get("level_m"),
                "rate_of_rise": r.get("rate_of_rise_m_per_hr") or r.get("rate_of_rise"),
            })

        for week, group in week_groups.items():
            await compute_baseline_from_history(station_name, week, group)
            baselines_computed += 1

    logger.info(
        "baseline_bootstrap_complete",
        stations=len(all_station_names),
        baselines=baselines_computed,
        skipped=skipped,
    )
    return {
        "stations_processed": len(all_station_names),
        "baselines_computed": baselines_computed,
        "skipped": skipped,
    }
