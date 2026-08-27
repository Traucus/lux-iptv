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
  player: {
    /**
     * Resolve a catalog row to a PlaybackSource (URL + headers + media format).
     * The renderer feeds this to hls.js or <video> directly.
     */
    getSource: (input: unknown) => ipcRenderer.invoke('player:getSource', input),
    /**
     * Resolve a catalog row to the absolute URL on the in-process stream
     * proxy. Returns `notImplemented` until the G5 proxy lands.
     */
    getProxiedUrl: (input: unknown) => ipcRenderer.invoke('player:getProxiedUrl', input),
    /**
     * Report a non-fatal playback error to main (logging only in this slice).
     */
    reportError: (input: unknown) => ipcRenderer.invoke('player:reportError', input),
    /**
     * Forward resume position updates to main (logging only in this slice).
     */
    reportProgress: (input: unknown) => ipcRenderer.invoke('player:reportProgress', input),
    /**
     * Given the current episode id, return the next episode in series order
     * or `null` at the end of the series.
     */
    getNextEpisode: (input: unknown) => ipcRenderer.invoke('player:getNextEpisode', input),
  },
};

contextBridge.exposeInMainWorld('luxAPI', luxAPI);

// Type declaration for the exposed API
declare global {
  interface Window {
    luxAPI: typeof luxAPI;
  }
}
