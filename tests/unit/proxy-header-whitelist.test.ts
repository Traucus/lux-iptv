import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { net } from 'electron';
import { StreamProxyService } from '../../src/main/services/stream-proxy';

// Mock the Electron net module
const { mockRequestFn } = vi.hoisted(() => ({
  mockRequestFn: vi.fn(),
}));

vi.mock('electron', () => ({
  net: {
    request: mockRequestFn,
  },
  protocol: {
    handle: vi.fn(),
  },
  ipcMain: {
    on: vi.fn(),
    emit: vi.fn(),
    handle: vi.fn(),
  },
}));

describe('StreamProxyService - Header Whitelist Security', () => {
  let db: InstanceType<typeof Database>;
  let service: StreamProxyService;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up in-memory database with catalog tables
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE live_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
        added_at INTEGER NOT NULL
      );
    `);

    service = new StreamProxyService();
    mockRequest = vi.mocked(net.request);
  });

  afterEach(async () => {
    await service.stop();
    db.close();
  });

  const setupMockResponse = (contentType = 'application/vnd.apple.mpegurl') => {
    const mockResponse = {
      statusCode: 200,
      headers: { 'content-type': contentType },
      on: vi.fn((event, cb) => {
        if (event === 'data') {
          setImmediate(() => cb(Buffer.from('#EXTM3U\n')));
        } else if (event === 'end') {
          setImmediate(() => cb());
        }
      }),
    };

    const mockRequestObj = {
      on: vi.fn((event, cb) => {
        if (event === 'response') setImmediate(() => cb(mockResponse));
      }),
      end: vi.fn(),
      setHeader: vi.fn(),
      setTimeout: vi.fn(),
    };

    mockRequest.mockReturnValue(mockRequestObj);
    return mockRequestObj;
  };

  it('allows User-Agent header', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({ 'User-Agent': 'CustomAgent/1.0' }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['User-Agent']).toBe('CustomAgent/1.0');
  });

  it('allows Referer header', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({ 'Referer': 'https://example.com/page' }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['Referer']).toBe('https://example.com/page');
  });

  it('allows Cookie header', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({ 'Cookie': 'session=abc123; theme=dark' }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['Cookie']).toBe('session=abc123; theme=dark');
  });

  it('allows valid custom headers from headers object', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'X-Custom-Header': 'value1', 'X-Another-Header': 'value2' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Custom-Header']).toBe('value1');
    expect(requestOptions.headers['X-Another-Header']).toBe('value2');
  });

  it('rejects header keys with invalid characters', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'X-Invalid!': 'bad', 'X-Valid': 'good' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Valid']).toBe('good');
    expect(requestOptions.headers['X-Invalid!']).toBeUndefined();
  });

  it('rejects hop-by-hop header: Connection', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'Connection': 'keep-alive', 'X-Valid': 'good' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Valid']).toBe('good');
    expect(requestOptions.headers['Connection']).toBeUndefined();
  });

  it('rejects hop-by-hop header: Transfer-Encoding', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'Transfer-Encoding': 'chunked', 'X-Valid': 'good' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Valid']).toBe('good');
    expect(requestOptions.headers['Transfer-Encoding']).toBeUndefined();
  });

  it('rejects hop-by-hop header: Content-Length', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'Content-Length': '1000', 'X-Valid': 'good' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Valid']).toBe('good');
    expect(requestOptions.headers['Content-Length']).toBeUndefined();
  });

  it('rejects hop-by-hop header: Host', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'Host': 'evil.com', 'X-Valid': 'good' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Valid']).toBe('good');
    expect(requestOptions.headers['Host']).toBeUndefined();
  });

  it('rejects hop-by-hop header: Upgrade', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'Upgrade': 'websocket', 'X-Valid': 'good' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Valid']).toBe('good');
    expect(requestOptions.headers['Upgrade']).toBeUndefined();
  });

  it('rejects hop-by-hop header: TE', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'TE': 'trailers', 'X-Valid': 'good' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Valid']).toBe('good');
    expect(requestOptions.headers['TE']).toBeUndefined();
  });

  it('normalizes custom header keys to canonical case', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      headers: { 'x-custom-header': 'value', 'X-ANOTHER-HEADER': 'value2' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Custom-Header']).toBe('value');
    expect(requestOptions.headers['X-Another-Header']).toBe('value2');
  });

  it('does not forward headers from root level that are not whitelisted', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Test', 'https://cdn.example.com/test.m3u8', JSON.stringify({
      'X-Root-Level': 'should-be-ignored',
      'User-Agent': 'ValidAgent',
      headers: { 'X-In-Headers': 'valid' }
    }), 'hls', 1000);

    setupMockResponse();

    await service.start(db);
    const port = service.getPort();
    await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['User-Agent']).toBe('ValidAgent');
    expect(requestOptions.headers['X-In-Headers']).toBe('valid');
    expect(requestOptions.headers['X-Root-Level']).toBeUndefined();
  });
});