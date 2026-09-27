import { describe, it, expect, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { registerPlayerHandlers } from '../../../src/main/ipc/handlers/player';
import type { LibmpvEngine } from '../../../src/main/player/libmpv-engine';

function captureIpcMain() {
  const captured: Array<{ channel: string; fn: (event: unknown, input: unknown) => Promise<unknown> }> = [];
  const ipc = {
    handle: (channel: string, fn: (event: unknown, input: unknown) => Promise<unknown>) => {
      captured.push({ channel, fn });
    },
  } as unknown as IpcMain;
  return { ipc, captured };
}

describe('player:setEmbedVisible', () => {
  it('hides and shows the native embed through the engine', async () => {
    const setEmbedVisible = vi.fn();
    const { ipc, captured } = captureIpcMain();
    registerPlayerHandlers(ipc, {
      db: {} as never,
      libmpvEngine: { setEmbedVisible } as unknown as LibmpvEngine,
    });
    const fn = captured.find((c) => c.channel === 'player:setEmbedVisible')!.fn;
    await expect(fn({}, { visible: false })).resolves.toEqual({ data: { visible: false } });
    expect(setEmbedVisible).toHaveBeenCalledWith(false);
    await expect(fn({}, { visible: true })).resolves.toEqual({ data: { visible: true } });
    expect(setEmbedVisible).toHaveBeenCalledWith(true);
  });
});
