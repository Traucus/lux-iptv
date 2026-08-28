// CJS entry point — sets hardware acceleration policy BEFORE any ESM imports
const { app } = require('electron');

// Linux GPU off unless LUX_HW_ACCEL=true, before ESM import.
if (
  process.platform === 'linux' &&
  String(process.env.LUX_HW_ACCEL || '').toLowerCase() !== 'true'
) {
  app.disableHardwareAcceleration();
}

// Load the real ESM entry point
import('./index.js');
