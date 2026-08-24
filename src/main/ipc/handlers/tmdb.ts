import type { IpcMain } from 'electron';
import { TmdbKeyInputSchema } from '../../../shared/schemas/tmdb';
import type { IpcResult } from '../../../shared/types/ipc';
import type { TmdbKeyVault } from '../../services/tmdb-key';

function invalidInput(details: unknown): IpcResult<never> {
  return { error: { code: 'INVALID_INPUT', message: 'Invalid input', details } };
}

export function registerTmdbHandlers(ipcMain: IpcMain, vault: TmdbKeyVault): void {
  ipcMain.handle('tmdb:setKey', async (_event, input: unknown) => {
    const result = TmdbKeyInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error);
    }

    try {
      const res = await vault.setTmdbKey(result.data.key);
      return { data: res };
    } catch (err) {
      return {
        error: {
          code: 'INTERNAL',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  });

  ipcMain.handle('tmdb:hasKey', async () => {
    const has = vault.hasTmdbKey();
    return { data: has };
  });

  ipcMain.handle('tmdb:clearKey', async () => {
    await vault.clearTmdbKey();
    return { data: undefined };
  });
}
