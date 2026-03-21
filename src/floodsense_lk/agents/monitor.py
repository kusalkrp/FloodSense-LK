"""Monitor Agent — fetches current state of all stations via MCP tools.

Calls 5 MCP tools in parallel, populates state:
  station_snapshots, rising_stations, alert_stations
Flags stale data (data_age_minutes > 45).
"""

import asyncio

import structlog

from floodsense_lk.agents.state import FloodSenseState
from floodsense_lk.config.settings import settings
from floodsense_lk.mcp.client import safe_call

logger = structlog.get_logger(__name__)

_STALE_THRESHOLD_MINUTES = 45


def _station_name(s: dict) -> str:
    """MCP responses use 'station' key; fall back to 'station_name' for compat."""
    return s.get("station") or s.get("station_name", "unknown")


def _flag_stale(snapshots: list[dict]) -> tuple[list[dict], list[str]]:
    """Mark stale stations and collect their names."""
    stale = []
    for s in snapshots:
        age = s.get("data_age_minutes", 0) or 0
        s["is_stale"] = age > _STALE_THRESHOLD_MINUTES
        if s["is_stale"]:
            stale.append(_station_name(s))
    return snapshots, stale


async def monitor_node(state: FloodSenseState) -> FloodSenseState:
    base_url = settings.mcp_server_url
    log = logger.bind(run_id=state["run_id"])

    # Fetch all 5 data sources in parallel
    results = await asyncio.gather(
        safe_call(base_url, "get_all_current_levels"),
        safe_call(base_url, "get_rising_stations", {"min_rate": 0.05}),
        safe_call(base_url, "get_alert_stations"),
        safe_call(base_url, "get_kelani_corridor"),
        safe_call(base_url, "get_all_basins_summary"),
        return_exceptions=False,
    )
    all_levels, rising, alerts, corridor, basins = results

    errors = list(state["errors"])

    # All current levels → station_snapshots
    station_snapshots: list[dict] = []
    if all_levels and isinstance(all_levels, dict):
        raw = all_levels.get("stations", [])
        station_snapshots, stale_names = _flag_stale(raw)
        if stale_names:
            log.warning("stale_stations_detected", stations=stale_names)
            errors.append(f"stale_data: {stale_names}")
    else:
        errors.append("mcp_get_all_current_levels_failed")
        log.error("monitor_mcp_failed", tool="get_all_current_levels")

    # Rising stations
    rising_stations: list[dict] = []
    if rising and isinstance(rising, dict):
        rising_stations = rising.get("stations", [])
    elif rising is None:
        errors.append("mcp_get_rising_stations_failed")

    # Alert stations (at or above ALERT threshold)
    alert_stations: list[dict] = []
    if alerts and isinstance(alerts, dict):
        alert_stations = alerts.get("stations", [])
    elif alerts is None:
        errors.append("mcp_get_alert_stations_failed")

    # Attach corridor data to relevant snapshots
    # MCP corridor response uses key "corridor" (not "stations")
    if corridor and isinstance(corridor, dict):
        corridor_stations = corridor.get("corridor") or corridor.get("stations", [])
        corridor_map = {_station_name(s): s for s in corridor_stations}
        for snap in station_snapshots:
            name = _station_name(snap)
            if name in corridor_map:
                snap["kelani_corridor"] = corridor_map[name]

    # Attach basin summary
    # MCP uses "basin" key, not "basin_name"
    if basins and isinstance(basins, dict):
        basin_map = {b.get("basin") or b.get("basin_name", ""): b for b in basins.get("basins", [])}
        for snap in station_snapshots:
            basin = snap.get("basin") or snap.get("basin_name", "")
            if basin in basin_map:
                snap["basin_summary"] = basin_map[basin]

    log.info(
        "monitor_complete",
        total_stations=len(station_snapshots),
        rising=len(rising_stations),
        alert=len(alert_stations),
    )

    return {
        **state,
        "station_snapshots": station_snapshots,
        "rising_stations": rising_stations,
        "alert_stations": alert_stations,
        "errors": errors,
    }
