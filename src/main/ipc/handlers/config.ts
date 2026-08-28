import type { IpcMain } from 'electron';
import type { ConfigService } from '../../services/config-service.js';

/**
 * Config IPC handler — save/load app configuration (credentials, preferences).
 */
export function registerConfigHandlers(ipcMain: IpcMain, configService: ConfigService): void {
  ipcMain.handle('config:saveCredentials', async (_event, input: unknown) => {
    const credentials = input as ConfigService['saveCredentials'] extends (arg: infer P) => unknown ? P : never;
    configService.saveCredentials(credentials);
    return { data: { ok: true } };
  });

  ipcMain.handle('config:loadCredentials', async () => {
    const credentials = configService.loadCredentials();
    return { data: credentials };
  });

  ipcMain.handle('config:hasSource', async () => {
    return { data: configService.hasSource() };
  });

  ipcMain.handle('config:sourceSummary', async () => {
    return { data: configService.sourceSummary() };
  });
}
