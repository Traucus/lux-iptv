import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import type { IpcMain } from 'electron';
import type { SqlJsCompatDb } from '../db/sqljs-adapter.js';
import { URL } from 'node:url';
import { resolveSameOriginHttp } from './hls-rewrite.js';
import { fetchAndStream } from './stream-proxy/fetch-and-stream.js';
import { parseHttpHeaders, sanitizeHeaders, tableForType } from './stream-proxy/headers.js';
import { setCacheEntry, type CacheEntry } from './stream-proxy/manifest-cache.js';
import {
  createNodeOriginRequest,
  type OriginRequest,
  type OriginRequestFactory,
} from './stream-proxy/origin-request.js';

export type { OriginRequest, OriginRequestFactory };
export { createNodeOriginRequest };

export class StreamProxyService {
  private server: Server | null = null;
  private port: number | null = null;
  private db: SqlJsCompatDb | null = null;
  private manifestCache = new Map<string, CacheEntry>();
  private ipcMain: IpcMain | null = null;

  constructor(private readonly createOriginRequest: OriginRequestFactory = createNodeOriginRequest) {}

  async start(db: SqlJsCompatDb): Promise<{ port: number }> {
    if (this.server) {
      return { port: this.port as number };
    }

    this.db = db;

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        void this.handleRequest(req, res);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          resolve({ port: this.port });
        } else {
          reject(new Error('Failed to bind proxy server'));
        }
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => {
          this.server = null;
          this.port = null;
          this.db = null;
          this.manifestCache.clear();
          resolve();
        });
      });
    }
  }

  getPort(): number | null {
    return this.port;
  }

  setIpcMain(ipcMain: IpcMain): void {
    this.ipcMain = ipcMain;
  }

  async lookupHeaders(type: string, id: number): Promise<Record<string, string>> {
    if (!this.db) return {};

    const table = tableForType(type);
    if (!table) return {};

    const row = this.db
      .prepare(`SELECT url, http_headers FROM ${table} WHERE id = ?`)
      .get(id) as { url: string; http_headers: string } | undefined;

    if (!row) return {};

    return parseHttpHeaders(row.http_headers);
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '', `http://127.0.0.1:${this.port}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts[0] === 'proxy' && pathParts[1] === 'health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (pathParts[0] === 'proxy' && pathParts[1] && pathParts[2]) {
      const type = pathParts[1];
      const id = parseInt(pathParts[2], 10);

      if (isNaN(id) || id <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid ID' }));
        return;
      }

      await this.proxyStream(req, res, type, id, url.searchParams.get('u'));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private async proxyStream(
    req: IncomingMessage,
    res: ServerResponse,
    type: string,
    id: number,
    uParam: string | null,
  ): Promise<void> {
    if (!this.db) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database not initialized' }));
      return;
    }

    const table = tableForType(type);
    if (!table) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid content type' }));
      return;
    }

    const row = this.db
      .prepare(`SELECT url, http_headers FROM ${table} WHERE id = ?`)
      .get(id) as { url: string; http_headers: string } | undefined;

    if (!row) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Content not found' }));
      return;
    }

    const originUrl = row.url;
    let targetUrl = originUrl;
    if (uParam) {
      const allowed = resolveSameOriginHttp(uParam, originUrl);
      if (!allowed) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Cross-origin URL rejected' }));
        return;
      }
      targetUrl = allowed;
    }
    const headers = sanitizeHeaders(parseHttpHeaders(row.http_headers));
    const range = req.headers.range;
    if (typeof range === 'string' && range.length > 0) {
      headers['Range'] = range;
    }

    const cacheKey = uParam ? `${type}:${id}:${targetUrl}` : `${type}:${id}`;
    const cached = this.manifestCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.writeHead(200, {
        'Content-Type': cached.contentType,
        'Content-Length': cached.body.length,
        'Cache-Control': 'public, max-age=30',
      });
      res.end(cached.body);
      return;
    }

    try {
      await fetchAndStream(targetUrl, headers, res, cacheKey, { type, id }, {
        createOriginRequest: this.createOriginRequest,
        emitError: (code, message) => this.emitError(code, message),
        setCacheEntry: (key, body, contentType) => this.setCacheEntry(key, body, contentType),
      });
    } catch (error) {
      this.emitError('STREAM_TIMEOUT', `Failed to fetch stream: ${error}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream timeout' }));
      }
    }
  }

  private setCacheEntry(key: string, body: Buffer, contentType: string): void {
    setCacheEntry(this.manifestCache, key, body, contentType);
  }

  private emitError(code: string, message: string): void {
    if (this.ipcMain) {
      this.ipcMain.emit('player:reportError', {
        code,
        message,
        ctx: { timestamp: Date.now() },
      });
    }
    console.warn(`[stream-proxy] ${code}: ${message}`);
  }
}
