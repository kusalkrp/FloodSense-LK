"""Admin routes — protected by X-Admin-Key header.

POST /api/v1/admin/run              — trigger pipeline immediately
POST /api/v1/admin/false-positive/{id} — mark anomaly as false positive
GET  /api/v1/admin/runs             — pipeline run history
"""

import asyncio

from fastapi import APIRouter, Depends, Header, HTTPException

from floodsense_lk.config.settings import settings
from floodsense_lk.core.exceptions import AdminAuthError
from floodsense_lk.core.security import verify_admin_key
from floodsense_lk.db import timescale
from floodsense_lk.services.baseline_service import bootstrap_all_baselines
from floodsense_lk.services.scheduler_service import run_pipeline

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_admin(x_admin_key: str = Header(...)) -> None:
    try:
        verify_admin_key(x_admin_key, settings.admin_api_key)
    except AdminAuthError:
        raise HTTPException(status_code=403, detail="invalid_admin_key")


@router.post("/run")
async def trigger_run(_: None = Depends(_require_admin)) -> dict:
    """Immediately trigger one pipeline run (bypasses scheduler interval)."""
    asyncio.create_task(run_pipeline())
    return {"status": "pipeline_triggered"}


@router.post("/false-positive/{anomaly_id}")
async def mark_false_positive(
    anomaly_id: int,
    _: None = Depends(_require_admin),
) -> dict:
    row = await timescale.fetchrow(
        "UPDATE anomaly_events SET false_positive = TRUE WHERE id = $1 RETURNING id",
        anomaly_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="anomaly_not_found")
    return {"status": "marked_false_positive", "id": anomaly_id}


@router.post("/bootstrap-baselines")
async def bootstrap_baselines(_: None = Depends(_require_admin)) -> dict:
    """One-time baseline bootstrap — pulls 7 days of MCP history for every station
    and populates station_baselines so z-score detection works immediately."""
    result = await bootstrap_all_baselines(settings.mcp_server_url)
    return result


@router.get("/runs")
async def get_runs(
    limit: int = 20,
    _: None = Depends(_require_admin),
) -> dict:
    rows = await timescale.fetch(
        """
        SELECT run_id, started_at, completed_at, status, monitoring_intensity,
               routing_decision, stations_checked, rising_count, anomalies_found,
               alerts_sent, error_message
        FROM pipeline_runs
        ORDER BY started_at DESC
        LIMIT $1
        """,
        limit,
    )
    return {"runs": [dict(r) for r in rows]}
