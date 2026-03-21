-- Migration 002: alert_history
-- Delivery log — no raw personal data ever stored here

CREATE TABLE IF NOT EXISTS alert_history (
    id                  BIGSERIAL PRIMARY KEY,
    anomaly_event_id    BIGINT      REFERENCES anomaly_events(id) ON DELETE SET NULL,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    channel             TEXT        NOT NULL
                        CHECK (channel IN ('WHATSAPP', 'SMS', 'EMAIL')),
    recipient_hash      TEXT        NOT NULL,   -- SHA256-HMAC(phone + ALERT_SALT)
    status              TEXT        NOT NULL
                        CHECK (status IN ('SENT', 'FAILED', 'SKIPPED_COOLDOWN', 'SKIPPED_FATIGUE')),
    provider_id         TEXT,                   -- Twilio message SID
    error_message       TEXT,
    language            TEXT        NOT NULL DEFAULT 'en'
);

CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at
    ON alert_history (sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_recipient
    ON alert_history (recipient_hash, sent_at DESC);
