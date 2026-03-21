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


@router.get("/ready")
async def ready() -> dict:
    """Readiness check — verifies DB is reachable."""
    try:
        await timescale.fetchrow("SELECT 1")
        return {"status": "ready"}
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="database_unavailable")
