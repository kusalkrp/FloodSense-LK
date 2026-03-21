-- Migration 007: Add encrypted_phone column for Twilio delivery
-- Stores AES-256-GCM encrypted phone number alongside the existing HMAC hash.
-- Hash = identity / dedup; encrypted = delivery only (decrypted at send time, never logged).

ALTER TABLE subscribers
    ADD COLUMN IF NOT EXISTS encrypted_phone TEXT;

COMMENT ON COLUMN subscribers.encrypted_phone IS
    'AES-256-GCM encrypted phone number (base64). Decrypted only at alert delivery. Never logged.';
