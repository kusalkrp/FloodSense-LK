-- Migration 003: station_baselines
-- Per-station per-ISO-week historical averages for anomaly detection
-- Recomputed every Sunday from mcp-lk-river-intel historical data

CREATE TABLE IF NOT EXISTS station_baselines (
    station_name        TEXT        NOT NULL,
    week_of_year        INT         NOT NULL CHECK (week_of_year BETWEEN 1 AND 53),
    avg_level_m         DECIMAL(8,4),
    stddev_level_m      DECIMAL(8,4),
    avg_rate_m_per_hr   DECIMAL(8,4),
    stddev_rate         DECIMAL(8,4),
    sample_count        INT         NOT NULL DEFAULT 0,
    low_confidence      BOOLEAN     NOT NULL DEFAULT FALSE,  -- TRUE if sample_count < 50
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (station_name, week_of_year)
);

CREATE INDEX IF NOT EXISTS idx_baselines_station
    ON station_baselines (station_name);
