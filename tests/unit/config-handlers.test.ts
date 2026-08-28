import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ConfigService } from '../../src/main/services/config-service';
import { registerConfigHandlers } from '../../src/main/ipc/handlers/config';

function tempService(): ConfigService {
  return new ConfigService(mkdtempSync(join(tmpdir(), 'lux-vault-')));
}

function register(service: ConfigService): Record<string, (event: unknown) => Promise<unknown>> {
  const handlers: Record<string, (event: unknown) => Promise<unknown>> = {};
  const mockIpcMain = {
    handle: (channel: string, handler: unknown) => {
      handlers[channel] = handler as (event: unknown) => Promise<unknown>;
    },
  };
  registerConfigHandlers(mockIpcMain as unknown as Electron.IpcMain, service);
  return handlers;
}

const XTREAM_SECRET = {
  source: 'xtream' as const,
  server: 'http://secret.example:8080',
  username: 'vault-user',
  password: 'super-secret',
  listName: 'Home IPTV',
};

describe('config vault IPC', () => {
  it('hasSource is { configured: false } when the vault is empty', async () => {
    const handlers = register(tempService());
    const result = await handlers['config:hasSource']({});
    expect(result).toEqual({ data: { configured: false } });
  });

  it('hasSource is { configured: true } after credentials are saved', async () => {
    const service = tempService();
    service.saveCredentials(XTREAM_SECRET);
    const handlers = register(service);
    const result = await handlers['config:hasSource']({});
    expect(result).toEqual({ data: { configured: true } });
  });

  it('sourceSummary returns listName and source type without secrets (D-2)', async () => {
    const service = tempService();
    service.saveCredentials(XTREAM_SECRET);
    const handlers = register(service);
    const result = (await handlers['config:sourceSummary']({})) as { data: Record<string, unknown> };
    expect(result.data).toEqual({
      configured: true,
      listName: 'Home IPTV',
      source: 'xtream',
    });
    expect(result.data).not.toHaveProperty('server');
    expect(result.data).not.toHaveProperty('username');
    expect(result.data).not.toHaveProperty('password');
    expect(result.data).not.toHaveProperty('url');
  });

  it('sourceSummary omits the M3U playlist URL', async () => {
    const service = tempService();
    service.saveCredentials({
      source: 'm3u',
      url: 'https://secret.example/playlist.m3u',
      listName: 'M3U List',
    });
    const handlers = register(service);
    const result = (await handlers['config:sourceSummary']({})) as { data: Record<string, unknown> };
    expect(result.data).toEqual({
      configured: true,
      listName: 'M3U List',
      source: 'm3u',
    });
    expect(result.data).not.toHaveProperty('url');
  });
});
