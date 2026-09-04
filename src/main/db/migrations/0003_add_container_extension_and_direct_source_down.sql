-- Down migration 0003: drops container_extension + direct_source only.
-- http_headers and media_format MUST remain.

BEGIN;

ALTER TABLE live_channels DROP COLUMN container_extension;
ALTER TABLE live_channels DROP COLUMN direct_source;

ALTER TABLE vod_movies DROP COLUMN container_extension;
ALTER TABLE vod_movies DROP COLUMN direct_source;

ALTER TABLE series DROP COLUMN container_extension;
ALTER TABLE series DROP COLUMN direct_source;

ALTER TABLE episodes DROP COLUMN container_extension;
ALTER TABLE episodes DROP COLUMN direct_source;

COMMIT;
