-- Migration 001: anomaly_events
-- Stores every detected anomaly with full context for audit and false-positive tracking

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS anomaly_events (
    id                  BIGSERIAL PRIMARY KEY,
    station_name        TEXT        NOT NULL,
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    anomaly_type        TEXT        NOT NULL
                        CHECK (anomaly_type IN ('RATE_SPIKE', 'LEVEL_ANOMALY', 'SEASONAL_DEVIATION', 'UPSTREAM_PROPAGATION')),
    severity            TEXT        NOT NULL
                        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    z_score             DECIMAL(8,4),
    current_level_m     DECIMAL(8,4),
    baseline_level_m    DECIMAL(8,4),
    current_rate        DECIMAL(8,4),
    baseline_rate       DECIMAL(8,4),
    rate_spike_ratio    DECIMAL(8,4),
    risk_score          INT         CHECK (risk_score BETWEEN 0 AND 100),
    upstream_context    TEXT,
    explanation         TEXT,
    confidence          DECIMAL(4,3),
    resolved_at         TIMESTAMPTZ,
    false_positive      BOOLEAN     NOT NULL DEFAULT FALSE,
    run_id              TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anomaly_station_time
    ON anomaly_events (station_name, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_anomaly_severity
    ON anomaly_events (severity, detected_at DESC)
    WHERE false_positive = FALSE;
