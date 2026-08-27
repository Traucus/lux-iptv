-- Down migration 0001: drops http_headers + media_format from all 4 tables.
--
-- WARNING: this is destructive — any header / format data stored since
-- migration 0001 ran will be lost. It exists for development / rollback
-- scenarios, NOT for production use. (REQ: migration rollback plan.)
--
-- Wrapped in a single transaction so a partial failure does not leave the
-- catalog schema in a half-migrated state.

BEGIN;

ALTER TABLE live_channels DROP COLUMN http_headers;
ALTER TABLE live_channels DROP COLUMN media_format;

ALTER TABLE vod_movies DROP COLUMN http_headers;
ALTER TABLE vod_movies DROP COLUMN media_format;

ALTER TABLE series DROP COLUMN http_headers;
ALTER TABLE series DROP COLUMN media_format;

ALTER TABLE episodes DROP COLUMN http_headers;
ALTER TABLE episodes DROP COLUMN media_format;

COMMIT;
