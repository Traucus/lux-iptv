import { parentPort, workerData } from 'worker_threads';
import type Database from 'better-sqlite3';
import { classify } from '../services/classifier';
import type { M3UEntry } from '../services/m3u-client';

export interface IngestCounts {
  live: number;
  movies: number;
  series: number;
  radio: number;
  total: number;
  aborted?: boolean;
}

type WorkerMessage =
  | { type: 'START'; payload: { source: 'xtream' | 'm3u'; entries?: M3UEntry[] } }
  | { type: 'CANCEL' };

let aborted = false;

/**
 * Processes M3U entries: classifies and persists to SQLite.
 * Exported for testing.
 */
export function processM3UEntries(db: Database.Database, entries: M3UEntry[]): IngestCounts {
  const counts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };
  const now = Date.now();

  // Prepare statements
  const insertLive = db.prepare(`
    INSERT INTO live_channels (xtream_id, name, url, group_title, tvg_id, tvg_logo, stream_type, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @tvgId, @tvgLogo, @streamType, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      tvg_id = excluded.tvg_id,
      tvg_logo = excluded.tvg_logo,
      stream_type = excluded.stream_type
  `);

  const insertMovie = db.prepare(`
    INSERT INTO vod_movies (xtream_id, name, url, group_title, cover, stream_type, year, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      cover = excluded.cover,
      stream_type = excluded.stream_type,
      year = excluded.year
  `);

  const insertSeries = db.prepare(`
    INSERT INTO series (xtream_id, name, url, group_title, cover, stream_type, year, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      cover = excluded.cover
  `);

  for (const entry of entries) {
    const contentType = classify({
      url: entry.url,
      name: entry.name,
      groupTitle: entry.groupTitle,
      tvgId: entry.tvgId,
    });

    switch (contentType) {
      case 'live':
        insertLive.run({
          xtreamId: null,
          name: entry.name,
          url: entry.url,
          groupTitle: entry.groupTitle,
          tvgId: entry.tvgId,
          tvgLogo: entry.tvgLogo,
          streamType: 'live',
          addedAt: now,
        });
        counts.live++;
        break;
      case 'movie':
        insertMovie.run({
          xtreamId: null,
          name: entry.name,
          url: entry.url,
          groupTitle: entry.groupTitle,
          cover: entry.tvgLogo,
          streamType: 'movie',
          year: null,
          addedAt: now,
        });
        counts.movies++;
        break;
      case 'series':
        // For series, we insert the series entry (episodes would need separate handling)
        insertSeries.run({
          xtreamId: null,
          name: entry.name,
          url: entry.url,
          groupTitle: entry.groupTitle,
          cover: entry.tvgLogo,
          streamType: 'series',
          year: null,
          addedAt: now,
        });
        counts.series++;
        break;
      case 'radio':
        insertLive.run({
          xtreamId: null,
          name: entry.name,
          url: entry.url,
          groupTitle: entry.groupTitle,
          tvgId: entry.tvgId,
          tvgLogo: entry.tvgLogo,
          streamType: 'radio',
          addedAt: now,
        });
        counts.radio++;
        break;
    }
    counts.total++;
  }

  return counts;
}

// Worker entry point
if (parentPort) {
  parentPort.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'CANCEL') {
      aborted = true;
      parentPort!.postMessage({
        type: 'DONE',
        jobId: workerData?.jobId ?? 'unknown',
        counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0, aborted: true },
        durationMs: 0,
      });
      return;
    }

    if (msg.type === 'START') {
      aborted = false;
      const startTime = Date.now();
      const entries = msg.payload.entries ?? [];

      // In a real worker, we'd get the DB from workerData or create it
      // For now, we just process entries and report progress
      const batchSize = 100;
      const counts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };

      for (let i = 0; i < entries.length; i += batchSize) {
        if (aborted) break;

        const batch = entries.slice(i, i + batchSize);
        // Classify each entry
        for (const entry of batch) {
          const contentType = classify({
            url: entry.url,
            name: entry.name,
            groupTitle: entry.groupTitle,
            tvgId: entry.tvgId,
          });

          switch (contentType) {
            case 'live': counts.live++; break;
            case 'movie': counts.movies++; break;
            case 'series': counts.series++; break;
            case 'radio': counts.radio++; break;
          }
          counts.total++;
        }

        // Report progress
        parentPort!.postMessage({
          type: 'PROGRESS',
          jobId: workerData?.jobId ?? 'unknown',
          phase: 'CLASSIFY',
          live: counts.live,
          movies: counts.movies,
          series: counts.series,
          radio: counts.radio,
          total: counts.total,
        });
      }

      parentPort!.postMessage({
        type: 'DONE',
        jobId: workerData?.jobId ?? 'unknown',
        counts: aborted ? { ...counts, aborted: true } : counts,
        durationMs: Date.now() - startTime,
      });
    }
  });
}
