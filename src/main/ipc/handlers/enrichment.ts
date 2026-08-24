import type { IpcMain } from 'electron';
import type { IpcResult, EnrichmentStatus } from '../../../shared/types/ipc';

// Status is updated by the renderer via IPC
let currentStatus: EnrichmentStatus = {
  queueLength: 0,
  lastEnrichedAt: null,
  isRunning: false,
};

export function updateEnrichmentStatus(status: Partial<EnrichmentStatus>): void {
  currentStatus = { ...currentStatus, ...status };
}

export function registerEnrichmentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('enrichment:getStatus', async (): Promise<IpcResult<EnrichmentStatus>> => {
    return { data: currentStatus };
  });

  // Allow renderer to update status
  ipcMain.on('enrichment:updateStatus', (_event, status: Partial<EnrichmentStatus>) => {
    updateEnrichmentStatus(status);
  });
}
