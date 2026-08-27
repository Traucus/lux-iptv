import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import type { IngestOrchestrator } from '../services/ingest-orchestrator';
import type { TmdbKeyVault } from '../services/tmdb-key';
import type Database from 'better-sqlite3';
import { registerIngestHandlers } from './handlers/ingest';
import { registerTmdbHandlers } from './handlers/tmdb';
import { registerEnrichmentHandlers } from './handlers/enrichment';
import { registerCatalogHandlers } from './handlers/catalog';
import { registerPlayerHandlers } from './handlers/player';

export type HandlerContext = {
  mainWindow: BrowserWindow;
};

/**
 * All dependencies the consolidated IPC handler bundle needs. Each `register*`
 * call picks the slice it cares about and ignores the rest.
 *
 * Callers (main process) wire the real services here. Tests construct a
 * partial deps object with only the slices they exercise.
 */
export interface HandlerDeps {
  mainWindow: BrowserWindow;
  db: Database.Database;
  ingestOrchestrator: IngestOrchestrator;
  tmdbVault: TmdbKeyVault;
  /**
   * Optional — returns the base URL of the in-process stream proxy. Only
   * present when the G5 StreamProxyService is running. When undefined, the
   * `player:getProxiedUrl` channel returns `notImplemented`.
   */
  getProxiedBaseUrl?: () => string | undefined;
}

/**
 * Registers every IPC channel in one place. This is the single entry point
 * main/index.ts calls at startup. It replaces the old `notImplemented()`
 * stub pattern: every channel is now backed by a real handler, even if
 * some resolvers still return "not yet implemented" (e.g. the proxy URL
 * resolver before G5 lands).
 */
export function registerHandlers(deps: HandlerDeps): void {
  registerIngestHandlers(ipcMain, deps.ingestOrchestrator);
  registerCatalogHandlers(ipcMain, { db: deps.db });
  registerEnrichmentHandlers(ipcMain);
  registerTmdbHandlers(ipcMain, deps.tmdbVault);
  registerPlayerHandlers(ipcMain, {
    db: deps.db,
    getProxiedBaseUrl: deps.getProxiedBaseUrl,
  });
}

// Re-export the top-level registration helper for backwards compatibility
// with older test files that import the symbol from this module.
export { ipcMain };
