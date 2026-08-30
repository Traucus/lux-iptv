import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import type { IngestOrchestrator } from '../services/ingest-orchestrator.js';
import type { TmdbKeyVault } from '../services/tmdb-key.js';
import type { SqlJsCompatDb } from '../db/sqljs-adapter.js';
import type { ConfigService } from '../services/config-service.js';
import { registerIngestHandlers } from './handlers/ingest.js';
import { registerTmdbHandlers } from './handlers/tmdb.js';
import { registerEnrichmentHandlers } from './handlers/enrichment.js';
import { registerCatalogHandlers } from './handlers/catalog.js';
import { registerPlayerHandlers } from './handlers/player.js';
import { registerConfigHandlers } from './handlers/config.js';

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
  db: SqlJsCompatDb;
  ingestOrchestrator: IngestOrchestrator;
  tmdbVault: TmdbKeyVault;
  configService: ConfigService;
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
  console.log('[ipc] registering handlers');
  registerIngestHandlers(ipcMain, deps.ingestOrchestrator, deps.configService);
  registerCatalogHandlers(ipcMain, {
    db: deps.db,
    loadXtreamCredentials: () => {
      const creds = deps.configService.loadCredentials();
      if (!creds?.server || !creds.username || !creds.password) return null;
      return { server: creds.server, username: creds.username, password: creds.password };
    },
  });
  registerEnrichmentHandlers(ipcMain);
  registerTmdbHandlers(ipcMain, deps.tmdbVault);
  registerPlayerHandlers(ipcMain, {
    db: deps.db,
    getProxiedBaseUrl: deps.getProxiedBaseUrl,
  });
  registerConfigHandlers(ipcMain, deps.configService);
  console.log('[ipc] all handlers registered');
}

// Re-export the top-level registration helper for backwards compatibility
// with older test files that import the symbol from this module.
export { ipcMain };