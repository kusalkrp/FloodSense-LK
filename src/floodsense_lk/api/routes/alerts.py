"""Alert history routes — GET /api/v1/alerts"""

from fastapi import APIRouter, Query

from floodsense_lk.db import timescale

router = APIRouter(prefix="/api/v1", tags=["alerts"])

_VALID_SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


@router.get("/alerts")
async def get_alerts(
    basin: str | None = Query(None),
    severity: str | None = Query(None),
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """Recent anomaly events, optionally filtered by basin, severity, and time window."""
    filters = ["false_positive = FALSE", f"detected_at > NOW() - ($1 || ' hours')::INTERVAL"]
    params: list = [str(hours)]
    idx = 2

    if basin:
        filters.append(f"basin_name ILIKE ${idx}")
        params.append(f"%{basin}%")
        idx += 1

    if severity and severity.upper() in _VALID_SEVERITIES:
        filters.append(f"severity = ${idx}")
        params.append(severity.upper())
        idx += 1

    where = " AND ".join(filters)
    params.append(limit)

    rows = await timescale.fetch(
        f"""
        SELECT id, station_name, basin_name, detected_at, anomaly_type,
               severity,
               z_score::FLOAT          AS z_score,
               rate_spike_ratio::FLOAT AS rate_spike_ratio,
               explanation,
               confidence::FLOAT       AS confidence,
               risk_score
        FROM anomaly_events
        WHERE {where}
        ORDER BY detected_at DESC
        LIMIT ${idx}
        """,
        *params,
    )
    return {"alerts": [dict(r) for r in rows], "total": len(rows)}


@router.get("/alerts/active")
async def get_active_alerts() -> dict:
    """Unresolved anomaly events from the last 6 hours."""
    rows = await timescale.fetch(
        """
        SELECT id, station_name, basin_name, detected_at, anomaly_type, severity, explanation
        FROM anomaly_events
        WHERE resolved_at IS NULL
          AND false_positive = FALSE
          AND detected_at > NOW() - INTERVAL '6 hours'
        ORDER BY severity DESC, detected_at DESC
        """
    )
    return {"active_alerts": [dict(r) for r in rows]}
