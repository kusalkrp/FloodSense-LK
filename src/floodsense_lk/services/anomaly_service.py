"""Anomaly detection logic — pure functions, no LLM calls.

Four detection methods:
  1. Z-score level anomaly
  2. Rate-of-rise spike
  3. Kelani corridor upstream propagation
  4. Compound basin risk
"""

import asyncio
from dataclasses import dataclass
from typing import Optional

import structlog

from floodsense_lk.services.baseline_service import get_baseline

logger = structlog.get_logger(__name__)

# ── Kelani corridor — (station_name, hours_to_colombo) ────────────────────────
KELANI_CORRIDOR = [
    ("Norwood",          5.0),
    ("Kithulgala",       4.0),
    ("Deraniyagala",     3.0),
    ("Glencourse",       2.5),
    ("Holombuwa",        2.0),
    ("Hanwella",         1.0),
    ("Nagalagam Street", 0.0),
]

_KELANI_SET = {name for name, _ in KELANI_CORRIDOR}


@dataclass
class AnomalySignal:
    anomaly_type: str       # RATE_SPIKE | LEVEL_ANOMALY | UPSTREAM_PROPAGATION | COMPOUND_BASIN
    severity: str           # LOW | MEDIUM | HIGH | CRITICAL
    z_score: float = 0.0
    rate_spike_ratio: float = 0.0
    upstream_propagation_eta_hrs: Optional[float] = None
    compound_score: float = 0.0
    explanation: str = ""


# ── 1. Z-score level anomaly ──────────────────────────────────────────────────

async def compute_z_score(
    station_name: str,
    current_level_m: float,
    week_of_year: int,
) -> float:
    baseline = await get_baseline(station_name, week_of_year)
    if not baseline:
        return 0.0
    stddev = baseline.get("stddev_level_m") or 0.0
    avg = baseline.get("avg_level_m") or 0.0
    if stddev == 0.0:
        return 0.0
    return round((current_level_m - avg) / stddev, 3)


def z_score_to_severity(z: float) -> Optional[str]:
    if z > 4.0:
        return "CRITICAL"
    if z > 3.0:
        return "HIGH"
    if z > 2.5:
        return "MEDIUM"
    if z > 2.0:
        return "LOW"
    return None


async def detect_level_anomaly(
    station_name: str,
    current_level_m: float,
    week_of_year: int,
) -> Optional[AnomalySignal]:
    z = await compute_z_score(station_name, current_level_m, week_of_year)
    severity = z_score_to_severity(z)
    if severity is None:
        return None
    return AnomalySignal(
        anomaly_type="LEVEL_ANOMALY",
        severity=severity,
        z_score=z,
        explanation=f"Level is {z:.1f} standard deviations above weekly baseline.",
    )


# ── 2. Rate-of-rise spike ─────────────────────────────────────────────────────

async def detect_rate_spike(
    station_name: str,
    current_rate: float,
    week_of_year: int,
) -> Optional[AnomalySignal]:
    if current_rate <= 0:
        return None

    baseline = await get_baseline(station_name, week_of_year)
    if not baseline:
        return None

    baseline_rate = baseline.get("avg_rate_m_per_hr") or 0.0
    if baseline_rate <= 0:
        return None

    ratio = current_rate / baseline_rate
    if ratio < 2.0:
        return None

    severity = "MEDIUM" if ratio < 3 else "HIGH" if ratio < 5 else "CRITICAL"
    return AnomalySignal(
        anomaly_type="RATE_SPIKE",
        severity=severity,
        rate_spike_ratio=round(ratio, 2),
        explanation=f"Rising at {ratio:.1f}x the normal rate for this week of year.",
    )


# ── 3. Kelani corridor upstream propagation ───────────────────────────────────

def detect_upstream_propagation(corridor_stations: list[dict]) -> list[dict]:
    """Return list of propagation warnings for Kelani corridor stations.

    corridor_stations: list of dicts with station_name and rate_of_rise from MCP.
    """
    rate_map = {s["station_name"]: s.get("rate_of_rise", 0.0) or 0.0
                for s in corridor_stations
                if s.get("station_name") in _KELANI_SET}

    warnings = []
    for i, (station, eta_to_colombo) in enumerate(KELANI_CORRIDOR[:-1]):
        rate = rate_map.get(station, 0.0)
        if rate > 0.15:
            for downstream, d_eta in KELANI_CORRIDOR[i + 1:]:
                eta_hrs = eta_to_colombo - d_eta
                warnings.append({
                    "source_station": station,
                    "affected_station": downstream,
                    "eta_hours": round(eta_hrs, 1),
                    "upstream_rate": round(rate, 4),
                    "anomaly_type": "UPSTREAM_PROPAGATION",
                    "severity": "HIGH" if eta_hrs < 2 else "MEDIUM",
                })
    return warnings


# ── 4. Compound basin risk ────────────────────────────────────────────────────

def compute_basin_compound_score(basin_name: str, rising_stations: list[dict]) -> float:
    basin_rising = [
        s for s in rising_stations
        if s.get("basin_name", "").lower() == basin_name.lower()
    ]
    n = len(basin_rising)
    if n == 0:
        return 0.0
    multiplier = 1.0 if n < 2 else 1.5 if n < 3 else 2.0
    avg_rate = sum(s.get("rate_of_rise", 0.0) or 0.0 for s in basin_rising) / n
    return round(min(avg_rate * multiplier * 10, 10.0), 2)


# ── Combined: run all detectors for one station ───────────────────────────────

async def run_all_detectors(
    station: dict,
    week_of_year: int,
    rising_stations: list[dict],
    kelani_corridor_stations: list[dict],
) -> list[AnomalySignal]:
    name = station.get("station_name", "")
    level = station.get("water_level_m") or station.get("level_m") or 0.0
    rate = station.get("rate_of_rise") or 0.0
    basin = station.get("basin_name", "")

    signals: list[AnomalySignal] = []

    level_sig, rate_sig = await asyncio.gather(
        detect_level_anomaly(name, float(level), week_of_year),
        detect_rate_spike(name, float(rate), week_of_year),
    )

    if level_sig:
        signals.append(level_sig)
    if rate_sig:
        signals.append(rate_sig)

    compound = compute_basin_compound_score(basin, rising_stations)
    if compound > 0:
        signals.append(AnomalySignal(
            anomaly_type="COMPOUND_BASIN",
            severity="HIGH" if compound >= 7 else "MEDIUM" if compound >= 4 else "LOW",
            compound_score=compound,
            explanation=f"Multiple stations rising in {basin} basin (compound score {compound}).",
        ))

    return signals
