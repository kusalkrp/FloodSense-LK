"""APScheduler setup and pipeline overlap prevention.

Uses a Redis NX key as a distributed lock so overlapping runs are impossible
even if the scheduler fires twice (e.g., after a restart).
"""

import uuid
from datetime import datetime, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from floodsense_lk.agents.graph import compiled_graph
from floodsense_lk.agents.state import FloodSenseState
from floodsense_lk.config.settings import settings
from floodsense_lk.core.exceptions import PipelineAlreadyRunningError
from floodsense_lk.db import redis_client

logger = structlog.get_logger(__name__)

_PIPELINE_LOCK_KEY = "floodsense:run:active"
_PIPELINE_LOCK_TTL = 600  # 10 minutes — hard upper bound for a pipeline run

_scheduler: AsyncIOScheduler | None = None


# ── Pipeline execution ─────────────────────────────────────────────────────────


def _sri_lanka_now() -> str:
    from datetime import timezone, timedelta
    tz_sl = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(tz_sl).isoformat()


async def run_pipeline() -> None:
    """Run one pipeline cycle. Skips if a run is already in progress."""
    run_id = str(uuid.uuid4())[:8]
    log = logger.bind(run_id=run_id)

    # Acquire pipeline lock (NX — only set if not exists)
    acquired = await redis_client.set_nx(_PIPELINE_LOCK_KEY, run_id, ttl=_PIPELINE_LOCK_TTL)
    if not acquired:
        log.info("pipeline_skipped_overlap")
        return

    log.info("pipeline_started")
    try:
        initial_state: FloodSenseState = {
            "run_id": run_id,
            "triggered_at": _sri_lanka_now(),
            "monitoring_intensity": "STANDARD",
            "station_snapshots": [],
            "rising_stations": [],
            "alert_stations": [],
            "anomalies_detected": [],
            "risk_assessments": [],
            "alerts_to_send": [],
            "alerts_sent": [],
            "report_summary": "",
            "errors": [],
        }
        await compiled_graph.ainvoke(initial_state)
        log.info("pipeline_completed")
    except Exception as exc:
        import traceback
        log.error("pipeline_failed", error=str(exc), traceback=traceback.format_exc())
    finally:
        await redis_client.delete(_PIPELINE_LOCK_KEY)


# ── Scheduler lifecycle ────────────────────────────────────────────────────────


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_pipeline,
        trigger=IntervalTrigger(seconds=settings.pipeline_interval_seconds),
        id="flood_monitor",
        replace_existing=True,
        max_instances=1,
    )
    return scheduler


async def start_scheduler() -> None:
    global _scheduler
    _scheduler = create_scheduler()
    _scheduler.start()
    logger.info("scheduler_started", interval_s=settings.pipeline_interval_seconds)


async def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("scheduler_stopped")
    _scheduler = None
