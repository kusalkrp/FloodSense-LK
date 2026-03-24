-- Migration 006: anomaly_events schema additions
-- Adds basin_name, upstream_propagation_eta_hrs; relaxes anomaly_type CHECK to allow COMPOUND_BASIN

ALTER TABLE anomaly_events
    ADD COLUMN IF NOT EXISTS basin_name TEXT,
    ADD COLUMN IF NOT EXISTS upstream_propagation_eta_hrs DECIMAL(6,2);

-- PostgreSQL does not support modifying CHECK inline; drop and re-add
ALTER TABLE anomaly_events DROP CONSTRAINT IF EXISTS anomaly_events_anomaly_type_check;
ALTER TABLE anomaly_events ADD CONSTRAINT anomaly_events_anomaly_type_check
    CHECK (anomaly_type IN (
        'RATE_SPIKE', 'LEVEL_ANOMALY', 'SEASONAL_DEVIATION',
        'UPSTREAM_PROPAGATION', 'COMPOUND_BASIN'
    ));
