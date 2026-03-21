"""LangGraph state definition for the FloodSense pipeline.

All agents read and write to this TypedDict.
Nothing persists between runs — use TimescaleDB/Redis for cross-run state.
"""

from typing import TypedDict


class FloodSenseState(TypedDict):
    run_id: str
    triggered_at: str                  # ISO 8601 +05:30
    monitoring_intensity: str          # STANDARD | ELEVATED | HIGH_ALERT
    station_snapshots: list[dict]      # all 40 stations from get_all_current_levels
    rising_stations: list[dict]        # from get_rising_stations
    alert_stations: list[dict]         # from get_alert_stations
    anomalies_detected: list[dict]     # output of anomaly agent per flagged station
    risk_assessments: list[dict]       # output of risk scorer per anomaly
    alerts_to_send: list[dict]         # composed alert payloads
    alerts_sent: list[dict]            # delivery receipts
    report_summary: str                # human-readable run summary
    errors: list[str]                  # non-fatal errors collected during run
