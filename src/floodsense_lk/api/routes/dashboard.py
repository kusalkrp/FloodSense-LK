"""Dashboard HTML routes — GET /dashboard, /dashboard/alerts, /dashboard/system"""

import json

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from floodsense_lk.db import redis_client, timescale

import pathlib
_TEMPLATES_DIR = pathlib.Path(__file__).parent.parent.parent / "templates"
templates = Jinja2Templates(directory=str(_TEMPLATES_DIR))

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    dashboard_raw = await redis_client.get("floodsense:dashboard:current")
    anomalies_raw = await redis_client.get("floodsense:anomalies:active")

    dashboard = json.loads(dashboard_raw) if dashboard_raw else {}
    active_anomalies = json.loads(anomalies_raw) if anomalies_raw else []
    active_station_names = [a.get("station_name", "") for a in active_anomalies]

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "active": "dashboard",
        "dashboard": dashboard,
        "active_anomalies": active_anomalies,
        "active_station_names": active_station_names,
    })


@router.get("/dashboard/alerts", response_class=HTMLResponse)
async def alerts_page(request: Request, basin: str = "", severity: str = "", hours: int = 24):
    filters = ["false_positive = FALSE", "detected_at > NOW() - ($1 || ' hours')::INTERVAL"]
    params: list = [str(hours)]
    idx = 2
    if basin:
        filters.append(f"basin_name ILIKE ${idx}")
        params.append(f"%{basin}%")
        idx += 1
    if severity:
        filters.append(f"severity = ${idx}")
        params.append(severity.upper())
        idx += 1
    params.append(100)
    where = " AND ".join(filters)
    rows = await timescale.fetch(
        f"SELECT * FROM anomaly_events WHERE {where} ORDER BY detected_at DESC LIMIT ${idx}",
        *params,
    )
    return templates.TemplateResponse("alerts.html", {
        "request": request,
        "active": "alerts",
        "alerts": [dict(r) for r in rows],
        "basin": basin,
        "severity": severity,
        "hours": hours,
    })


@router.get("/dashboard/system", response_class=HTMLResponse)
async def system_page(request: Request):
    runs = await timescale.fetch(
        "SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 20"
    )
    last_run_row = await timescale.fetchrow(
        "SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 1"
    )
    total_row = await timescale.fetchrow("SELECT COUNT(*) AS n FROM pipeline_runs")
    anomaly_row = await timescale.fetchrow(
        "SELECT COUNT(*) AS n FROM anomaly_events WHERE detected_at > NOW() - INTERVAL '24 hours' AND false_positive = FALSE"
    )
    # Pull stale station list from Redis dashboard snapshot (not DB error column)
    stale_stations: list[str] = []
    dashboard_raw = await redis_client.get("floodsense:dashboard:current")
    if dashboard_raw:
        dash = json.loads(dashboard_raw)
        for e in dash.get("errors", []):
            if e.startswith("stale_data:"):
                import ast
                try:
                    stale_stations = ast.literal_eval(e.split("stale_data:", 1)[1].strip())
                except Exception:
                    pass
    return templates.TemplateResponse("system.html", {
        "request": request,
        "active": "system",
        "runs": [dict(r) for r in runs],
        "last_run": dict(last_run_row) if last_run_row else None,
        "total_runs": int(total_row["n"]) if total_row else 0,
        "anomaly_count_24h": int(anomaly_row["n"]) if anomaly_row else 0,
        "stale_stations": stale_stations,
    })
