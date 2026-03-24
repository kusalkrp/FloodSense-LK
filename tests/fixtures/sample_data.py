"""Shared test data fixtures."""

SAMPLE_STATION = {
    "station_name": "Hanwella",
    "basin_name": "Kelani Ganga",
    "water_level_m": 3.45,
    "rate_of_rise": 0.18,
    "alert_level": "NORMAL",
    "data_age_minutes": 12,
    "is_stale": False,
}

SAMPLE_RISING_STATION = {
    "station_name": "Glencourse",
    "basin_name": "Kelani Ganga",
    "water_level_m": 4.10,
    "rate_of_rise": 0.25,
    "alert_level": "ALERT",
    "data_age_minutes": 8,
}

SAMPLE_BASELINE = {
    "station_name": "Hanwella",
    "week_of_year": 12,
    "avg_level_m": 2.80,
    "stddev_level_m": 0.30,
    "avg_rate_m_per_hr": 0.06,
    "stddev_rate": 0.02,
    "sample_count": 120,
    "low_confidence": False,
}

SAMPLE_ANOMALY = {
    "anomaly_detected": True,
    "anomaly_type": "RATE_SPIKE",
    "severity": "HIGH",
    "z_score": 2.17,
    "rate_spike_ratio": 3.0,
    "upstream_propagation_eta_hrs": None,
    "explanation": "Rising at 3x normal rate.",
    "confidence": 0.87,
    "station_name": "Hanwella",
    "basin_name": "Kelani Ganga",
    "current_level_m": 3.45,
    "rate_of_rise": 0.18,
    "event_id": 42,
}

SAMPLE_RISK = {
    "station": "Hanwella",
    "station_name": "Hanwella",
    "basin_name": "Kelani Ganga",
    "risk_score": 72,
    "risk_level": "HIGH",
    "score_breakdown": {"z_score_pts": 15, "rate_spike_pts": 25, "upstream_pts": 0, "compound_pts": 5, "multiplier": 1.2},
    "should_alert": True,
    "recommendation": "Monitor Hanwella closely — evacuate low-lying areas if rising continues.",
    "anomaly_type": "RATE_SPIKE",
    "event_id": 42,
}
