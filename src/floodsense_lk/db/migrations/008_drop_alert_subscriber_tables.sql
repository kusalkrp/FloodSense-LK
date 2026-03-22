-- Migration 008: Drop subscriber and alert delivery tables
-- FloodSense LK is now fully public — no user accounts or PII stored.

DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS subscribers CASCADE;
