-- Migration 0004: EPG programmes for live now/next and the later S9 guide.

BEGIN;

CREATE TABLE IF NOT EXISTS epg_programmes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  UNIQUE(channel_id, start_at),
  FOREIGN KEY (channel_id) REFERENCES live_channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS epg_channel_time_idx ON epg_programmes (channel_id, start_at, end_at);

COMMIT;
