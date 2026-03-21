-- Migration 004: subscribers
-- Preferences stored with hashed contact info — no raw PII ever

CREATE TABLE IF NOT EXISTS subscribers (
    id                  BIGSERIAL PRIMARY KEY,
    phone_hash          TEXT        UNIQUE,                  -- SHA256-HMAC(phone + ALERT_SALT)
    email_hash          TEXT        UNIQUE,                  -- SHA256-HMAC(email + ALERT_SALT)
    basins              TEXT[]      NOT NULL DEFAULT '{}',   -- e.g. {"Kelani Ganga","Kalu Ganga"}
    stations            TEXT[]      NOT NULL DEFAULT '{}',   -- specific stations (optional)
    min_severity        TEXT        NOT NULL DEFAULT 'HIGH'
                        CHECK (min_severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    channels            TEXT[]      NOT NULL DEFAULT '{WHATSAPP,SMS}',
    language            TEXT        NOT NULL DEFAULT 'en'
                        CHECK (language IN ('en', 'si')),
    active              BOOLEAN     NOT NULL DEFAULT TRUE,
    verified            BOOLEAN     NOT NULL DEFAULT FALSE,  -- OTP verified before alerts sent
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_alert_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscribers_active
    ON subscribers (active, verified)
    WHERE active = TRUE AND verified = TRUE;
