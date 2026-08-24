import { app, BrowserWindow } from 'electron';

// TODO: Import preload script path
// TODO: Import renderer URL or file path based on environment

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
