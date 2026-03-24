-- Migration 005: pipeline_runs
-- One row per LangGraph pipeline execution for monitoring and debugging

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              TEXT        UNIQUE NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL,
    completed_at        TIMESTAMPTZ,
    duration_ms         INT,
    status              TEXT        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
    monitoring_intensity TEXT       CHECK (monitoring_intensity IN ('STANDARD', 'ELEVATED', 'HIGH_ALERT')),
    routing_decision    TEXT,       -- e.g. "anomaly_detected" or "calm_day_fast_path"
    stations_checked    INT,
    rising_count        INT,
    alert_count         INT,
    anomalies_found     INT,
    alerts_sent         INT,
    error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at
    ON pipeline_runs (started_at DESC);
