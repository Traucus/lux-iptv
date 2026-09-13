// CJS entry point — sets hardware acceleration policy BEFORE any ESM imports
const { app } = require('electron');
const path = require('node:path');

if (!process.env.LUX_LIBMPV_DIR) {
  process.env.LUX_LIBMPV_DIR = path.join(__dirname, '..', '..', 'vendor', 'libmpv');
}

// Linux/Windows Chromium GPU off unless LUX_HW_ACCEL=true, before ESM import.
// Windows GPU compositor otherwise covers the libmpv child HWND.
if (
  String(process.env.LUX_HW_ACCEL || '').toLowerCase() !== 'true' &&
  (process.platform === 'linux' || process.platform === 'win32')
) {
  app.disableHardwareAcceleration();
}

console.info('[lux] LUX_LIBMPV_DIR=', process.env.LUX_LIBMPV_DIR);

// Load the real ESM entry point
import('./index.js');
