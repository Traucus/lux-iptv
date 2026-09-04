-- Migration 0003: add container_extension + direct_source to all 4 catalog tables.
--
-- Honest play URLs need the real container (mkv, not invented mp4) and an
-- optional Xtream/M3U direct_source. Both columns default to '' so existing
-- rows stay valid without a data backfill.
--
-- Wrapped in a single BEGIN/COMMIT so any ALTER failure rolls back the batch.

BEGIN;

ALTER TABLE live_channels ADD COLUMN container_extension TEXT NOT NULL DEFAULT '';
ALTER TABLE live_channels ADD COLUMN direct_source TEXT NOT NULL DEFAULT '';

ALTER TABLE vod_movies ADD COLUMN container_extension TEXT NOT NULL DEFAULT '';
ALTER TABLE vod_movies ADD COLUMN direct_source TEXT NOT NULL DEFAULT '';

ALTER TABLE series ADD COLUMN container_extension TEXT NOT NULL DEFAULT '';
ALTER TABLE series ADD COLUMN direct_source TEXT NOT NULL DEFAULT '';

ALTER TABLE episodes ADD COLUMN container_extension TEXT NOT NULL DEFAULT '';
ALTER TABLE episodes ADD COLUMN direct_source TEXT NOT NULL DEFAULT '';

COMMIT;
