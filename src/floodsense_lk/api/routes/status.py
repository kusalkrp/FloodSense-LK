"""Status routes — GET /api/v1/status, /api/v1/stations, /ready"""

import json

from fastapi import APIRouter

from floodsense_lk.db import redis_client, timescale

router = APIRouter(prefix="/api/v1", tags=["status"])


@router.get("/status")
async def get_status() -> dict:
    """Latest pipeline run summary and dashboard snapshot from Redis."""
    dashboard_raw = await redis_client.get("floodsense:dashboard:current")
    summary_raw = await redis_client.get("floodsense:run:last_summary")

    dashboard = json.loads(dashboard_raw) if dashboard_raw else {}
    summary = json.loads(summary_raw) if summary_raw else {}

    return {
        "dashboard": dashboard,
        "last_run_summary": summary.get("summary", "No runs yet."),
    }


@router.get("/stations/current")
async def get_stations_current() -> dict:
    """Current status of all stations — level, alert, rate — from last pipeline run."""
    raw = await redis_client.get("floodsense:stations:current")
    return {"stations": json.loads(raw) if raw else []}


@router.get("/stations")
async def list_stations(basin: str | None = None) -> dict:
    """List stations from anomaly_events (stations we have seen anomalies for)."""
    if basin:
        rows = await timescale.fetch(
            "SELECT DISTINCT station_name, basin_name FROM anomaly_events WHERE basin_name ILIKE $1 ORDER BY station_name",
            f"%{basin}%",
        )
    else:
        rows = await timescale.fetch(
            "SELECT DISTINCT station_name, basin_name FROM anomaly_events ORDER BY station_name"
        )
    return {"stations": [dict(r) for r in rows]}


@router.get("/baselines/{station_name}")
async def get_baseline(station_name: str) -> dict:
    """Per-station per-week baselines."""
    rows = await timescale.fetch(
        """
        SELECT week_of_year, avg_level_m, stddev_level_m,
               avg_rate_m_per_hr, sample_count, low_confidence, computed_at
        FROM station_baselines
        WHERE station_name = $1
        ORDER BY week_of_year
        """,
        station_name,
    )
    return {"station_name": station_name, "baselines": [dict(r) for r in rows]}


@router.get("/basins")
async def get_basins() -> dict:
    """Basin-level aggregation from current station data."""
    raw = await redis_client.get("floodsense:stations:current")
    stations = json.loads(raw) if raw else []

    basins: dict[str, dict] = {}
    for s in stations:
        b = s.get("basin") or "Unknown"
        if b not in basins:
            basins[b] = {"basin": b, "stations": [], "max_level_m": 0, "avg_level_m": 0,
                         "rising_count": 0, "alert_count": 0, "stale_count": 0, "highest_alert": "NORMAL"}
        basins[b]["stations"].append(s)

    ALERT_ORDER = {"NORMAL": 0, "ALERT": 1, "MINOR_FLOOD": 2, "MAJOR_FLOOD": 3}
    result = []
    for b, d in basins.items():
        sts = d["stations"]
        levels = [s["level_m"] for s in sts if s.get("level_m") is not None]
        result.append({
            "basin": b,
            "station_count": len(sts),
            "max_level_m": round(max(levels), 3) if levels else None,
            "avg_level_m": round(sum(levels)/len(levels), 3) if levels else None,
            "rising_count": sum(1 for s in sts if (s.get("rate") or 0) > 0.05),
            "alert_count": sum(1 for s in sts if s.get("alert_level") != "NORMAL"),
            "stale_count": sum(1 for s in sts if s.get("stale")),
            "highest_alert": max((s.get("alert_level","NORMAL") for s in sts), key=lambda a: ALERT_ORDER.get(a,0)),
        })
    result.sort(key=lambda x: -(x["avg_level_m"] or 0))
    return {"basins": result}


@router.get("/stations/{station_name}/history")
async def get_station_history(station_name: str, hours: int = 48) -> dict:
    """Proxy to MCP get_station_history — returns normalized time-series readings.

    Also includes the current-week baseline (avg ± stddev) so the frontend
    can render a seasonal comparison band.
    """
    from datetime import datetime, timezone, timedelta
    from floodsense_lk.mcp.client import safe_call
    from floodsense_lk.config.settings import settings

    hours = max(1, min(hours, 168))

    # Fetch MCP history and current-week baseline in parallel
    import asyncio
    sl_tz = timezone(timedelta(hours=5, minutes=30))
    week = datetime.now(sl_tz).isocalendar().week

    history_raw, baseline_row = await asyncio.gather(
        safe_call(settings.mcp_server_url, "get_station_history", {"station_name": station_name, "hours": hours}),
        timescale.fetchrow(
            "SELECT avg_level_m, stddev_level_m, avg_rate_m_per_hr FROM station_baselines WHERE station_name = $1 AND week_of_year = $2",
            station_name, week,
        ),
    )

    readings_raw = []
    if isinstance(history_raw, dict):
        readings_raw = history_raw.get("readings") or history_raw.get("data") or []
    elif isinstance(history_raw, list):
        readings_raw = history_raw

    readings = []
    for r in readings_raw:
        ts = (r.get("timestamp") or r.get("measured_at")
              or r.get("observed_at") or r.get("time"))
        level = r.get("water_level_m") if r.get("water_level_m") is not None else r.get("level_m")
        rate = (r.get("rate_of_rise_m_per_hr") if r.get("rate_of_rise_m_per_hr") is not None
                else r.get("rate_of_rise") if r.get("rate_of_rise") is not None
                else r.get("rate"))
        if ts is not None and level is not None:
            readings.append({"timestamp": str(ts), "level_m": float(level), "rate": float(rate or 0)})

    baseline = None
    if baseline_row:
        baseline = {
            "avg_level_m": float(baseline_row["avg_level_m"] or 0),
            "stddev_level_m": float(baseline_row["stddev_level_m"] or 0),
            "avg_rate_m_per_hr": float(baseline_row["avg_rate_m_per_hr"] or 0),
        }

    return {"station_name": station_name, "hours": hours, "readings": readings, "baseline": baseline}


@router.get("/pipeline/runs")
async def get_pipeline_runs(limit: int = 20) -> dict:
    """Recent pipeline run history — public summary stats."""
    limit = max(1, min(limit, 100))
    rows = await timescale.fetch(
        """
        SELECT started_at, completed_at, duration_ms, status,
               monitoring_intensity, routing_decision,
               stations_checked, rising_count, anomalies_found
        FROM pipeline_runs
        ORDER BY started_at DESC
        LIMIT $1
        """,
        limit,
    )
    return {"runs": [dict(r) for r in rows]}


@router.get("/ready")
async def ready() -> dict:
    """Readiness check — verifies DB is reachable."""
    try:
        await timescale.fetchrow("SELECT 1")
        return {"status": "ready"}
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="database_unavailable")
