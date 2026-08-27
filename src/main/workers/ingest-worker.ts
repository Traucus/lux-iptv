import { parentPort, workerData } from 'worker_threads';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '../db/migrate';
import { classify } from '../services/classifier';
import { fetchM3U } from '../services/m3u-client';
import type { M3UEntry } from '../services/m3u-client';

export interface IngestCounts {
  live: number;
  movies: number;
  series: number;
  radio: number;
  total: number;
  aborted?: boolean;
}

interface IngestWorkerData {
  jobId: string;
  source: 'm3u' | 'xtream';
  url?: string;
  credentials?: { server: string; username: string; password: string };
  dbPath: string;
}

type WorkerMessage =
  | { type: 'START' }
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

/**
 * Opens the SQLite catalog DB and ensures the schema is applied.
 * Returns null when dbPath is missing (e.g. unit tests that don't need a DB).
 */
function openCatalogDb(dbPath: string | undefined): Database.Database | null {
  if (!dbPath) return null;
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // The migration is applied at app startup before the worker is spawned, so
  // we don't re-run it here. The schema is expected to exist.
  return db;
}

function getMigrationsDir(): string {
  // dist/main/workers/ingest-worker.js → dist/main/db/migrations
  return join(__dirname, '..', 'db', 'migrations');
}

function emitError(code: 'AUTH_FAILED' | 'CONNECTION_ERROR' | 'PARSE_ERROR' | 'DB_ERROR', message: string, retryable: boolean): void {
  parentPort?.postMessage({
    type: 'ERROR',
    jobId: workerData?.jobId ?? 'unknown',
    code,
    message,
    retryable,
  });
}

function emitProgress(phase: string, counts: IngestCounts): void {
  parentPort?.postMessage({
    type: 'PROGRESS',
    jobId: workerData?.jobId ?? 'unknown',
    phase,
    live: counts.live,
    movies: counts.movies,
    series: counts.series,
    radio: counts.radio,
    total: counts.total,
  });
}

function emitDone(counts: IngestCounts, durationMs: number): void {
  parentPort?.postMessage({
    type: 'DONE',
    jobId: workerData?.jobId ?? 'unknown',
    counts,
    durationMs,
  });
}

/**
 * Runs the ingestion pipeline end-to-end inside the worker thread.
 * Exported for testing — production uses the parentPort message handler below.
 */
export async function runIngestion(data: IngestWorkerData): Promise<IngestCounts> {
  aborted = false;
  const startTime = Date.now();

  // Open DB
  const db = openCatalogDb(data.dbPath);
  if (!db) {
    emitError('DB_ERROR', 'DB_ERROR: missing dbPath in workerData', false);
    throw new Error('DB_ERROR: missing dbPath in workerData');
  }

  try {
    // Run migrations so the schema is in place when the worker opens a fresh
    // catalog. The migrate() helper is idempotent — applying the same set
    // repeatedly is a no-op.
    const { loadMigrations } = await import('../db/migrate');
    const migrationsDir = getMigrationsDir();
    const migrations = loadMigrations(migrationsDir);
    migrate(db, migrations);

    // Fetch entries
    emitProgress('FETCH', { live: 0, movies: 0, series: 0, radio: 0, total: 0 });

    let entries: M3UEntry[];
    if (data.source === 'm3u') {
      if (!data.url) {
        emitError('CONNECTION_ERROR', 'CONNECTION_ERROR: M3U source requires url', false);
        throw new Error('M3U source requires url');
      }
      try {
        entries = await fetchM3U(data.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const code = message.includes('AUTH_FAILED') ? 'AUTH_FAILED' : 'CONNECTION_ERROR';
        const retryable = code === 'CONNECTION_ERROR';
        emitError(code, message, retryable);
        throw err;
      }
    } else {
      // Xtream support is not yet wired through the worker. The orchestrator
      // only sends source-specific work when the matching path is implemented.
      emitError('PARSE_ERROR', 'PARSE_ERROR: Xtream ingestion is not implemented yet', false);
      throw new Error('Xtream ingestion is not implemented yet');
    }

    if (aborted) {
      const counts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0, aborted: true };
      emitDone(counts, Date.now() - startTime);
      return counts;
    }

    // Persist in batches so we can report progress and check the abort flag.
    const batchSize = 100;
    const totalCounts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };

    for (let i = 0; i < entries.length; i += batchSize) {
      if (aborted) break;

      const batch = entries.slice(i, i + batchSize);
      const batchCounts = processM3UEntries(db, batch);
      totalCounts.live += batchCounts.live;
      totalCounts.movies += batchCounts.movies;
      totalCounts.series += batchCounts.series;
      totalCounts.radio += batchCounts.radio;
      totalCounts.total += batchCounts.total;

      emitProgress('PERSIST', totalCounts);
    }

    const finalCounts: IngestCounts = aborted
      ? { ...totalCounts, aborted: true }
      : totalCounts;
    emitDone(finalCounts, Date.now() - startTime);
    return finalCounts;
  } finally {
    db.close();
  }
}

// Worker entry point — runs when this file is loaded via new Worker(...)
if (parentPort) {
  const data = (workerData ?? {}) as IngestWorkerData;

  parentPort.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'CANCEL') {
      aborted = true;
      parentPort!.postMessage({
        type: 'DONE',
        jobId: data.jobId ?? 'unknown',
        counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0, aborted: true },
        durationMs: 0,
      });
      return;
    }

    if (msg.type === 'START') {
      // Fire-and-forget: errors are reported via parentPort messages so the
      // orchestrator can surface them to the renderer.
      runIngestion(data).catch(() => {
        // Error already reported via emitError(). Swallow to keep the worker
        // alive long enough to deliver the DONE / ERROR message.
      });
    }
  });
}
