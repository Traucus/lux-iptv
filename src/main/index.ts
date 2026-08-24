import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createDb } from './db/client';
import { migrate, loadMigrations } from './db/migrate';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Lux IPTV',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      // TODO: Configure preload script
      // preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
    autoHideMenuBar: true,
  });

  // TODO: Load renderer (dev server or built files)
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.loadURL('http://localhost:5173');
  //   mainWindow.webContents.openDevTools();
  // } else {
  //   mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  // }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Run database migration before creating window
  try {
    const dbPath = join(app.getPath('userData'), 'catalog.db');
    const { sqlite } = createDb(dbPath);
    const migrationsDir = join(__dirname, 'db', 'migrations');
    const migrations = loadMigrations(migrationsDir);
    migrate(sqlite, migrations);
    sqlite.close();
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// TODO: Add IPC handlers
// TODO: Add auto-updater
// TODO: Add licensing validation on startup
