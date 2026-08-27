-- Migration 0001: add http_headers + media_format to all 4 catalog tables.
--
-- Rationale:
--   * HTTP request headers (User-Agent, Referer, Cookie) need to be persisted
--     per stream so the stream proxy (G5) can inject them on outbound fetches.
--   * `media_format` lets the player (G6) pick the right engine without
--     re-detecting the URL on every render.
--
-- Safety:
--   * All 8 ALTER TABLE statements are wrapped in a single BEGIN/COMMIT.
--     If any statement fails, the whole batch rolls back (no partial state).
--   * Both columns are NOT NULL with safe deterministic defaults ('{}' and
--     'unknown'), so existing rows auto-populate without a data migration.
--   * SQLite `ALTER TABLE ADD COLUMN` is metadata-only — fast even on large
--     tables, no row rewrite.
--
-- Rollback: see 0001_add_http_headers_and_media_format_down.sql.

BEGIN;

ALTER TABLE live_channels ADD COLUMN http_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE live_channels ADD COLUMN media_format  TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE vod_movies ADD COLUMN http_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE vod_movies ADD COLUMN media_format  TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE series ADD COLUMN http_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE series ADD COLUMN media_format  TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE episodes ADD COLUMN http_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE episodes ADD COLUMN media_format  TEXT NOT NULL DEFAULT 'unknown';

COMMIT;
