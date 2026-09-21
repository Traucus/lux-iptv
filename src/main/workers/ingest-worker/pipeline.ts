import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../db/sqljs-adapter.js';
import { migrate } from '../../db/migrate.js';
import { fetchM3U, type M3UEntry } from '../../services/m3u-client.js';
import { fetchXtreamLive, fetchXtreamVod, fetchXtreamSeries } from '../../services/xtream-client.js';
import { isIngestAborted, setIngestAborted } from './abort.js';
import { emitDone, emitError, emitLog, emitProgress } from './messages.js';
import { persistBatches } from './persist.js';
import type { IngestCounts, IngestWorkerData } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  // After the split: dist/main/workers/ingest-worker/pipeline.js → same target
  return join(__dirname, '..', '..', 'db', 'migrations');
}

/**
 * Runs the ingestion pipeline end-to-end inside the worker thread.
 * Exported for testing — production uses the parentPort message handler.
 */
export async function runIngestion(data: IngestWorkerData): Promise<IngestCounts> {
  setIngestAborted(false);
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
    const { loadMigrations } = await import('../../db/migrate.js');
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

    if (isIngestAborted()) {
      const counts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0, aborted: true };
      emitDone(counts, Date.now() - startTime);
      return counts;
    }

    // M3U persist in batches so we can report progress and check the abort flag.
    const totalCounts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };
    persistBatches(db, entries, totalCounts);

    const finalCounts: IngestCounts = isIngestAborted()
      ? { ...totalCounts, aborted: true }
      : totalCounts;
    emitDone(finalCounts, Date.now() - startTime);
    return finalCounts;
  } finally {
    db.close();
  }
}
