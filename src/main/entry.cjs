// CJS entry point — sets hardware acceleration policy BEFORE any ESM imports
const { app } = require('electron');

// Disable GPU on Linux before ESM modules trigger GPU initialization
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
}

// Load the real ESM entry point
import('./index.js');
