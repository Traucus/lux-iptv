import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import { IngestStartInputSchema, IngestCancelInputSchema, IngestProgressInputSchema } from '../../shared/schemas/ingest';
import { CatalogListInputSchema, CatalogGetByIdInputSchema } from '../../shared/schemas/catalog';
import { TmdbKeyInputSchema } from '../../shared/schemas/tmdb';
import type { ErrorCode, IpcResult } from '../../shared/types/ipc';

export type HandlerContext = {
  mainWindow: BrowserWindow;
};

function invalidInput(details: unknown): IpcResult<never> {
  return { error: { code: 'INVALID_INPUT' as ErrorCode, message: 'Invalid input', details } };
}

function notImplemented(): IpcResult<never> {
  return { error: { code: 'INTERNAL' as ErrorCode, message: 'not yet implemented' } };
}

function wrapHandler<TInput>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: TInput; error?: unknown } },
  handler: (input: TInput) => Promise<IpcResult<unknown>>,
) {
  return async (_event: unknown, input: unknown) => {
    const result = schema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error);
    }
    return handler(result.data as TInput);
  };
}

function wrapNoInputHandler(handler: () => Promise<IpcResult<unknown>>) {
  return async () => handler();
}

export function registerHandlers(ctx: HandlerContext): void {
  // ─── Ingest ──────────────────────────────────────────────────────────────
  ipcMain.handle(
    'ingest:start',
    wrapHandler(IngestStartInputSchema, async () => notImplemented()),
  );

  ipcMain.handle(
    'ingest:cancel',
    wrapHandler(IngestCancelInputSchema, async () => notImplemented()),
  );

  ipcMain.handle(
    'ingest:getProgress',
    wrapHandler(IngestProgressInputSchema, async () => notImplemented()),
  );

  // ─── Catalog ─────────────────────────────────────────────────────────────
  ipcMain.handle(
    'catalog:list',
    wrapHandler(CatalogListInputSchema, async () => notImplemented()),
  );

  ipcMain.handle(
    'catalog:getById',
    wrapHandler(CatalogGetByIdInputSchema, async () => notImplemented()),
  );

  // ─── Enrichment ──────────────────────────────────────────────────────────
  ipcMain.handle(
    'enrichment:getStatus',
    wrapNoInputHandler(async () => notImplemented()),
  );

  // ─── TMDB ────────────────────────────────────────────────────────────────
  ipcMain.handle(
    'tmdb:setKey',
    wrapHandler(TmdbKeyInputSchema, async () => notImplemented()),
  );

  ipcMain.handle(
    'tmdb:hasKey',
    wrapNoInputHandler(async () => notImplemented()),
  );

  ipcMain.handle(
    'tmdb:clearKey',
    wrapNoInputHandler(async () => notImplemented()),
  );

  // Keep reference to context for future use
  void ctx;
}
