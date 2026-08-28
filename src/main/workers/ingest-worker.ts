import { parentPort, workerData } from 'worker_threads';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../db/sqljs-adapter.js';
import { migrate } from '../db/migrate.js';
import { classify } from '../services/classifier.js';
import { fetchM3U } from '../services/m3u-client.js';
import { fetchXtreamLive, fetchXtreamVod, fetchXtreamSeries } from '../services/xtream-client.js';
import type { M3UEntry, M3UEntryHttpHints } from '../services/m3u-client.js';

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
export function processM3UEntries(db: SqlJsCompatDb, entries: M3UEntry[]): IngestCounts {
  const counts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };
  const now = Date.now();

  // Prepare statements
  const insertLive = db.prepare(`
    INSERT INTO live_channels (xtream_id, name, url, group_title, tvg_id, tvg_logo, stream_type, http_headers, media_format, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @tvgId, @tvgLogo, @streamType, @httpHeaders, @mediaFormat, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      tvg_id = excluded.tvg_id,
      tvg_logo = excluded.tvg_logo,
      stream_type = excluded.stream_type,
      http_headers = excluded.http_headers,
      media_format = excluded.media_format
  `);

  const insertMovie = db.prepare(`
    INSERT INTO vod_movies (xtream_id, name, url, group_title, cover, stream_type, year, http_headers, media_format, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @httpHeaders, @mediaFormat, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      cover = excluded.cover,
      stream_type = excluded.stream_type,
      year = excluded.year,
      http_headers = excluded.http_headers,
      media_format = excluded.media_format
  `);

  const insertSeries = db.prepare(`
    INSERT INTO series (xtream_id, name, url, group_title, cover, stream_type, year, http_headers, media_format, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @httpHeaders, @mediaFormat, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      cover = excluded.cover,
      http_headers = excluded.http_headers,
      media_format = excluded.media_format
  `);

  for (const entry of entries) {
    // Defensive: skip entries with no name — Xtream APIs sometimes return
    // null/empty names which would violate NOT NULL DB constraints.
    if (!entry.name || entry.name.trim().length === 0) continue;
    if (!entry.url || entry.url.trim().length === 0) continue;

    const contentType = classify({
      url: entry.url,
      name: entry.name,
      groupTitle: entry.groupTitle,
      tvgId: entry.tvgId,
    });

    // Flatten M3U HttpHints shape (`{ userAgent, referer, cookie, headers }`)
    // into the canonical header-name → value map the DB column expects.
    const httpHeaders = m3uHttpToWire(entry.http);
    const mediaFormat = entry.mediaFormat ?? 'unknown';

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
          httpHeaders: JSON.stringify(httpHeaders),
          mediaFormat,
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
          httpHeaders: JSON.stringify(httpHeaders),
          mediaFormat,
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
          httpHeaders: JSON.stringify(httpHeaders),
          mediaFormat,
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
          httpHeaders: JSON.stringify(httpHeaders),
          mediaFormat,
          addedAt: now,
        });
        counts.radio++;
        break;
    }
    counts.total++;
  }

  return counts;
}

function persistBatches(db: SqlJsCompatDb, entries: M3UEntry[], totalCounts: IngestCounts): void {
  const batchSize = 100;
  for (let i = 0; i < entries.length; i += batchSize) {
    if (aborted) break;
    const batchCounts = processM3UEntries(db, entries.slice(i, i + batchSize));
    totalCounts.live += batchCounts.live;
    totalCounts.movies += batchCounts.movies;
    totalCounts.series += batchCounts.series;
    totalCounts.radio += batchCounts.radio;
    totalCounts.total += batchCounts.total;
    emitProgress('PERSIST', totalCounts);
  }
}

/**
 * Maps M3U `HttpHints` (`userAgent/referer/cookie/headers`) into the canonical
 * wire-format header map (`User-Agent/Referer/Cookie/<custom>`). Returns `{}`
 * when no hints are present so the JSON column stays compact.
 */
function m3uHttpToWire(http: M3UEntryHttpHints | null): Record<string, string> {
  if (!http) return {};
  const out: Record<string, string> = { ...(http.headers ?? {}) };
  if (http.userAgent) out['User-Agent'] = http.userAgent;
  if (http.referer) out['Referer'] = http.referer;
  if (http.cookie) out['Cookie'] = http.cookie;
  return out;
}

/**
 * Opens the SQLite catalog DB and ensures the schema is applied.
 * Returns null when dbPath is missing (e.g. unit tests that don't need a DB).
 */
function openCatalogDb(dbPath: string | undefined): SqlJsCompatDb | null {
  if (!dbPath) return null;
  const db = createSqlJsDb(dbPath);
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

function emitLog(message: string): void {
  parentPort?.postMessage({
    type: 'LOG',
    jobId: workerData?.jobId ?? 'unknown',
    message,
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
  await initSqlJsModule();

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
    const { loadMigrations } = await import('../db/migrate.js');
    const migrationsDir = getMigrationsDir();
    const migrations = loadMigrations(migrationsDir);
    migrate(db, migrations);
    emitLog('DB ready, migrations applied');

    // Fetch entries
    emitProgress('FETCH', { live: 0, movies: 0, series: 0, radio: 0, total: 0 });

    let entries: M3UEntry[];
    if (data.source === 'm3u') {
      if (!data.url) {
        emitError('CONNECTION_ERROR', 'CONNECTION_ERROR: M3U source requires url', false);
        throw new Error('M3U source requires url');
      }
      emitLog(`Fetching M3U from ${data.url}`);
      try {
        entries = await fetchM3U(data.url);
        emitLog(`M3U fetched: ${entries.length} entries`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const code = message.includes('AUTH_FAILED') ? 'AUTH_FAILED' : 'CONNECTION_ERROR';
        const retryable = code === 'CONNECTION_ERROR';
        emitError(code, message, retryable);
        throw err;
      }
    } else {
      // Xtream Codes API — fetch live, VOD, and series in sequence
      if (!data.credentials) {
        emitError('CONNECTION_ERROR', 'CONNECTION_ERROR: Xtream source requires credentials', false);
        throw new Error('Xtream source requires credentials');
      }
      emitLog(`Xtream: fetching from ${data.credentials.server} as ${data.credentials.username}`);
      try {
        const totalCounts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };

        emitProgress('FETCH_LIVE', totalCounts);
        const liveEntries = await fetchXtreamLive(data.credentials);
        emitLog(`Xtream live: ${liveEntries.length} channels`);
        persistBatches(db, liveEntries, totalCounts);
        db.flush();

        emitProgress('FETCH_VOD', totalCounts);
        const vodEntries = await fetchXtreamVod(data.credentials);
        emitLog(`Xtream VOD: ${vodEntries.length} movies`);
        persistBatches(db, vodEntries, totalCounts);
        db.flush();

        emitProgress('FETCH_SERIES', totalCounts);
        const seriesEntries = await fetchXtreamSeries(data.credentials);
        emitLog(`Xtream series: ${seriesEntries.length} shows`);
        db.exec('DELETE FROM episodes');
        db.exec('DELETE FROM series');
        persistBatches(db, seriesEntries, totalCounts);
        db.flush();
        emitLog(`Xtream persisted live=${totalCounts.live} movies=${totalCounts.movies} series=${totalCounts.series}`);

        emitDone(totalCounts, Date.now() - startTime);
        return totalCounts;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        emitLog(`Xtream error: ${message}`);
        const code = message.includes('AUTH_FAILED') ? 'AUTH_FAILED' : 'CONNECTION_ERROR';
        const retryable = code === 'CONNECTION_ERROR';
        emitError(code, message, retryable);
        throw err;
      }
    }

    if (aborted) {
      const counts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0, aborted: true };
      emitDone(counts, Date.now() - startTime);
      return counts;
    }

    // M3U persist in batches so we can report progress and check the abort flag.
    const totalCounts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };
    persistBatches(db, entries, totalCounts);

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
      parentPort!.postMessage({ type: 'LOG', jobId: data.jobId ?? 'unknown', message: 'Worker received START' });
      runIngestion(data).catch((err) => {
        const message = err instanceof Error ? err.message : 'Unknown worker error';
        parentPort!.postMessage({ type: 'LOG', jobId: data.jobId ?? 'unknown', message: `Worker crashed: ${message}` });
        parentPort!.postMessage({
          type: 'ERROR',
          jobId: data.jobId ?? 'unknown',
          code: 'DB_ERROR',
          message,
          retryable: false,
        });
      });
    }
  });

  parentPort.postMessage({ type: 'LOG', jobId: data.jobId ?? 'unknown', message: 'Worker thread started' });
}