import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script for Lux IPTV
 * Exposes safe APIs to the renderer process via contextBridge
 */

// TODO: Define IPC channels and expose them safely
// Example:
// contextBridge.exposeInMainWorld('electronAPI', {
//   licensing: {
//     activate: (key: string) => ipcRenderer.invoke('licensing:activate', key),
//     validate: () => ipcRenderer.invoke('licensing:validate'),
//   },
//   player: {
//     loadPlaylist: (url: string) => ipcRenderer.invoke('player:loadPlaylist', url),
//   },
//   system: {
//     getMachineId: () => ipcRenderer.invoke('system:getMachineId'),
//     getVersion: () => ipcRenderer.invoke('system:getVersion'),
//   },
// });

// Placeholder: expose a minimal API for type checking
contextBridge.exposeInMainWorld('luxAPI', {
  ping: () => ipcRenderer.invoke('ping'),
});

// Type declaration for the exposed API
declare global {
  interface Window {
    luxAPI: {
      ping: () => Promise<string>;
    };
  }
}
