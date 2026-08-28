import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSqlJsModule } from './db/sqljs-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { createDb } from './db/client.js';
import { migrate, loadMigrations } from './db/migrate.js';
import { registerHandlers } from './ipc/index.js';
import { IngestOrchestrator } from './services/ingest-orchestrator.js';
import { createTmdbKeyVault } from './services/tmdb-key.js';
import { StreamProxyService } from './services/stream-proxy.js';

let mainWindow: BrowserWindow | null = null;
let dbHandle: ReturnType<typeof createDb> | null = null;
let ingestOrchestrator: IngestOrchestrator | null = null;
let streamProxyService: StreamProxyService | null = null;

/**
 * Resolves the preload script path. The compiled main bundle lives at
 * `dist/main/index.js`, so the preload is the sibling file at
 * `dist/preload/index.js`. We use `__dirname` so the path is stable
 * across dev (vitest) and prod (electron-builder) layouts.
 */
function resolvePreloadPath(): string {
  return join(__dirname, '..', 'preload', 'index.js');
}

/**
 * Resolves the renderer entry point:
 *  - dev: load the Vite dev server on port 5173
 *  - prod: load the built `dist/renderer/index.html` via `file://`
 */
function resolveRendererTarget(): { kind: 'url'; url: string } | { kind: 'file'; file: string } {
  if (process.env.NODE_ENV === 'development') {
    return { kind: 'url', url: 'http://localhost:5173' };
  }
  return { kind: 'file', file: join(__dirname, '..', 'renderer', 'index.html') };
}

function createWindow(): void {
  const preloadPath = resolvePreloadPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Lux IPTV',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
    show: false,
    autoHideMenuBar: true,
  });

  // Load renderer (dev server or built file)
  const target = resolveRendererTarget();
  if (target.kind === 'url') {
    void mainWindow.loadURL(target.url);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(target.file);
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize sql.js WASM module before any database operations
  await initSqlJsModule();

  // Run database migration before creating window
  try {
    const dbPath = join(app.getPath('userData'), 'catalog.db');
    dbHandle = createDb(dbPath);
    const migrationsDir = join(__dirname, 'db', 'migrations');
    const migrations = loadMigrations(migrationsDir);
    migrate(dbHandle.sqlite, migrations);
    // Keep the handle open for the lifetime of the app — close on quit.

    // Create services that need a live window reference (only the orchestrator
    // does — the rest take deps via the register call).
    if (!mainWindow) {
      throw new Error('Internal: mainWindow must exist by app ready');
    }
    ingestOrchestrator = new IngestOrchestrator(mainWindow);
    const tmdbVault = createTmdbKeyVault(join(app.getPath('userData'), 'tmdb.key'));

    // Start the stream proxy service (G5)
    streamProxyService = new StreamProxyService();
    await streamProxyService.start(dbHandle.sqlite);
    streamProxyService.setIpcMain(ipcMain);

    // Register every IPC channel in one shot.
    registerHandlers({
      mainWindow,
      db: dbHandle.sqlite,
      ingestOrchestrator,
      tmdbVault,
      getProxiedBaseUrl: () => streamProxyService!.getPort()
        ? `http://127.0.0.1:${streamProxyService!.getPort()}`
        : undefined,
    });
  } catch (err) {
    console.error('Fatal: database migration failed', err);
    app.exit(1);
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async () => {
  await streamProxyService?.stop();
  streamProxyService = null;
  dbHandle?.sqlite.close();
  dbHandle = null;
  ingestOrchestrator = null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});