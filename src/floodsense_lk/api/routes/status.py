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


@router.get("/ready")
async def ready() -> dict:
    """Readiness check — verifies DB is reachable."""
    try:
        await timescale.fetchrow("SELECT 1")
        return {"status": "ready"}
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="database_unavailable")
