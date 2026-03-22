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
    errors = state["errors"]
    # stale_data warnings are informational — only hard errors (MCP failures, DB errors) count
    hard_errors = [e for e in errors if not e.startswith("stale_data:")]
    has_hard_errors = bool(hard_errors)

    # Determine routing decision label
    if n_anomalies == 0:
        routing = "calm_day_fast_path"
    elif n_sent > 0:
        routing = "anomaly_detected_alerts_sent"
    else:
        routing = "anomaly_detected_no_alerts"

    # FAILED only when no stations were checked (MCP unreachable) or hard errors with no data
    status = "FAILED" if (len(state["station_snapshots"]) == 0 or has_hard_errors) else "COMPLETED"

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
        "; ".join(hard_errors) if hard_errors else None,
    )


async def _update_redis_dashboard(state: FloodSenseState, summary: str) -> None:
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

    # Always write anomalies (write empty list on calm run to clear stale data)
    await redis_client.set(
        "floodsense:anomalies:active",
        json.dumps(state["anomalies_detected"]),
        _DASHBOARD_TTL,
    )

    # Per-station current status for the map
    station_summary = [
        {
            "name": s.get("station") or s.get("station_name", ""),
            "basin": s.get("basin") or s.get("basin_name", ""),
            "level_m": s.get("water_level_m"),
            "alert_level": s.get("alert_level", "NORMAL"),
            "rate": round(float(s.get("rate_of_rise_m_per_hr") or s.get("rate_of_rise") or 0), 4),
            "pct": s.get("pct_of_alert_threshold"),
            "trend": s.get("trend", "STABLE"),
            "stale": s.get("is_stale", False),
        }
        for s in state["station_snapshots"]
    ]
    await redis_client.set(
        "floodsense:stations:current",
        json.dumps(station_summary),
        _DASHBOARD_TTL,
    )

    await redis_client.set_no_ttl(
        "floodsense:run:last_summary",
        json.dumps({"summary": summary, "run_id": state["run_id"]}),
    )


async def _write_risk_scores(risk_assessments: list[dict]) -> None:
    """Update anomaly_events.risk_score for each scored anomaly."""
    for assessment in risk_assessments:
        event_id = assessment.get("event_id")
        risk_score = assessment.get("risk_score")
        if event_id is None or risk_score is None:
            continue
        try:
            await timescale.execute(
                "UPDATE anomaly_events SET risk_score = $1 WHERE id = $2",
                int(risk_score),
                int(event_id),
            )
        except Exception as exc:
            logger.warning("risk_score_writeback_failed", event_id=event_id, error=str(exc))


async def report_agent_node(state: FloodSenseState) -> FloodSenseState:
    summary = _build_summary(state)
    started_at = state.get("triggered_at", datetime.now(_SL_TZ).isoformat())

    try:
        await _persist_run(state, summary, started_at)
        logger.info("pipeline_run_persisted", run_id=state["run_id"])
    except Exception as exc:
        logger.warning("pipeline_run_persist_failed", run_id=state["run_id"], error=str(exc))

    if state.get("risk_assessments"):
        try:
            await _write_risk_scores(state["risk_assessments"])
            logger.info("risk_scores_written", count=len(state["risk_assessments"]))
        except Exception as exc:
            logger.warning("risk_scores_write_failed", error=str(exc))

    try:
        await _update_redis_dashboard(state, summary)
        logger.info("dashboard_updated", run_id=state["run_id"])
    except Exception as exc:
        logger.warning("dashboard_update_failed", run_id=state["run_id"], error=str(exc))

    logger.info(
        "report_agent_complete",
        run_id=state["run_id"],
        summary=summary,
    )
    return {**state, "report_summary": summary}
