import { contextBridge, ipcRenderer } from 'electron';

const luxAPI = {
  ingest: {
    start: (input: unknown) => ipcRenderer.invoke('ingest:start', input),
    cancel: (input: unknown) => ipcRenderer.invoke('ingest:cancel', input),
    getProgress: (input: unknown) => ipcRenderer.invoke('ingest:getProgress', input),
    onProgress: (cb: (progress: unknown) => void) => {
      const listener = (_event: unknown, progress: unknown) => cb(progress);
      ipcRenderer.on('ingest:progress', listener);
      return () => {
        ipcRenderer.removeListener('ingest:progress', listener);
      };
    },
  },
  catalog: {
    list: (input: unknown) => ipcRenderer.invoke('catalog:list', input),
    getById: (input: unknown) => ipcRenderer.invoke('catalog:getById', input),
  },
  enrichment: {
    getStatus: () => ipcRenderer.invoke('enrichment:getStatus'),
  },
  tmdb: {
    setKey: (input: unknown) => ipcRenderer.invoke('tmdb:setKey', input),
    hasKey: () => ipcRenderer.invoke('tmdb:hasKey'),
    clearKey: () => ipcRenderer.invoke('tmdb:clearKey'),
  },
};

contextBridge.exposeInMainWorld('luxAPI', luxAPI);

// Type declaration for the exposed API
declare global {
  interface Window {
    luxAPI: typeof luxAPI;
  }
}
