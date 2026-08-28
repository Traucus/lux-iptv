-- Migration 0002: add url column to series table.
--
-- The series table was created without a url column, but processM3UEntries
-- and bulkInsertSeries both try to INSERT with url. Without it, all series
-- inserts fail silently (sql.js) or throw, resulting in 0 series in DB.
--
-- Also adds a unique index on url for ON CONFLICT(upsert) support, matching
-- the live_channels and vod_movies tables.

BEGIN;

ALTER TABLE series ADD COLUMN url TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX series_url_unique ON series (url);

COMMIT;
