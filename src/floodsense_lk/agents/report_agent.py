"""Report Agent — writes pipeline run summary to DB and updates Redis dashboard.

Runs at the end of every pipeline execution, regardless of path taken.
"""

import json
import time
from datetime import datetime, timezone, timedelta

import structlog

from floodsense_lk.agents.state import FloodSenseState
from floodsense_lk.db import timescale, redis_client

logger = structlog.get_logger(__name__)

_SL_TZ = timezone(timedelta(hours=5, minutes=30))
_DASHBOARD_TTL = 2100   # 35 minutes


def _build_summary(state: FloodSenseState) -> str:
    n_stations = len(state["station_snapshots"])
    n_rising = len(state["rising_stations"])
    n_alert = len(state["alert_stations"])
    n_anomalies = len(state["anomalies_detected"])
    n_sent = len(state["alerts_sent"])
    errors = state["errors"]

    parts = [
        f"Run {state['run_id']} | intensity={state['monitoring_intensity']}",
        f"Stations checked: {n_stations} | Rising: {n_rising} | At alert: {n_alert}",
        f"Anomalies detected: {n_anomalies} | Alerts sent: {n_sent}",
    ]
    if errors:
        parts.append(f"Errors ({len(errors)}): {'; '.join(errors[:3])}")
    return " | ".join(parts)


async def _persist_run(state: FloodSenseState, summary: str, started_at: str) -> None:
    n_rising = len(state["rising_stations"])
    n_anomalies = len(state["anomalies_detected"])
    n_sent = len(state["alerts_sent"])
    has_errors = bool(state["errors"])

    # Determine routing decision label
    if n_anomalies == 0:
        routing = "calm_day_fast_path"
    elif n_sent > 0:
        routing = "anomaly_detected_alerts_sent"
    else:
        routing = "anomaly_detected_no_alerts"

    status = "FAILED" if has_errors and n_anomalies == 0 else "COMPLETED"

    now_sl = datetime.now(_SL_TZ)

    # Parse started_at ISO string → datetime for asyncpg
    try:
        started_dt = datetime.fromisoformat(started_at)
    except (ValueError, TypeError):
        started_dt = now_sl

    await timescale.execute(
        """
        INSERT INTO pipeline_runs
            (run_id, started_at, completed_at, status, monitoring_intensity,
             routing_decision, stations_checked, rising_count, alert_count,
             anomalies_found, alerts_sent, error_message)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (run_id) DO NOTHING
        """,
        state["run_id"],
        started_dt,
        now_sl,
        status,
        state["monitoring_intensity"],
        routing,
        len(state["station_snapshots"]),
        n_rising,
        len(state["alert_stations"]),
        n_anomalies,
        n_sent,
        "; ".join(state["errors"]) if state["errors"] else None,
    )


async def _update_redis_dashboard(state: FloodSenseState) -> None:
    dashboard = {
        "run_id": state["run_id"],
        "updated_at": datetime.now(_SL_TZ).isoformat(),
        "monitoring_intensity": state["monitoring_intensity"],
        "stations_total": len(state["station_snapshots"]),
        "stations_rising": len(state["rising_stations"]),
        "stations_alert": len(state["alert_stations"]),
        "anomalies_active": len(state["anomalies_detected"]),
        "alerts_sent_this_run": len(state["alerts_sent"]),
        "errors": state["errors"],
    }
    await redis_client.set(
        "floodsense:dashboard:current",
        json.dumps(dashboard),
        _DASHBOARD_TTL,
    )

    if state["anomalies_detected"]:
        await redis_client.set(
            "floodsense:anomalies:active",
            json.dumps(state["anomalies_detected"]),
            _DASHBOARD_TTL,
        )

    await redis_client.set_no_ttl(
        "floodsense:run:last_summary",
        json.dumps({"summary": state["report_summary"], "run_id": state["run_id"]}),
    )


async def report_agent_node(state: FloodSenseState) -> FloodSenseState:
    summary = _build_summary(state)
    started_at = state.get("triggered_at", datetime.now(_SL_TZ).isoformat())

    try:
        await _persist_run(state, summary, started_at)
        logger.info("pipeline_run_persisted", run_id=state["run_id"])
    except Exception as exc:
        logger.warning("pipeline_run_persist_failed", run_id=state["run_id"], error=str(exc))

    try:
        await _update_redis_dashboard(state)
        logger.info("dashboard_updated", run_id=state["run_id"])
    except Exception as exc:
        logger.warning("dashboard_update_failed", run_id=state["run_id"], error=str(exc))

    logger.info(
        "report_agent_complete",
        run_id=state["run_id"],
        summary=summary,
    )
    return {**state, "report_summary": summary}
