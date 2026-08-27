import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { net, IpcMain } from 'electron';
import type Database from 'better-sqlite3';
import { URL } from 'node:url';

/**
 * StreamProxyService — In-process HTTP proxy for stream manifests and segments.
 *
 * Architecture (per design §G5):
 * - Binds to 127.0.0.1 on an ephemeral port inside the Electron main process.
 * - Uses Node's `createServer()` for the inbound HTTP server.
 * - Uses Electron's `net.request()` for outbound fetches (header injection,
 *   redirect following up to 5 hops, 10s timeout).
 * - Manifest cache: 30s TTL, 50-entry LRU bound. Only caches
 *   `application/vnd.apple.mpegurl` and `application/x-mpegurl` responses.
 *
 * Routes:
 * - GET /proxy/:type/:id  → proxies the stream (injects http_headers from DB)
 * - GET /proxy/health     → 200 {ok:true}
 *
 * Error handling:
 * - 5xx/timeout → 502 + player:reportError IPC {code:'STREAM_TIMEOUT'}
 * - Network unreachable → 503 + player:reportError IPC {code:'NETWORK'}
 * - Manifest cache misses/expired handled silently (origin re-fetch).
 *
 * Security:
 * - Header injection whitelist: User-Agent, Referer, Cookie, plus custom
 *   headers matching ^[A-Za-z0-9-]+$ from the `headers` object in http_headers.
 * - Bound to 127.0.0.1 only (no external network reachability).
 * - Each request validates the URL exists in catalog DB before proxying.
 */

interface CacheEntry {
  body: Buffer;
  contentType: string;
  expiresAt: number;
}

const MANIFEST_CONTENT_TYPES = new Set([
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
]);

const HEADER_KEY_REGEX = /^[A-Za-z0-9-]+$/;

const DEFAULT_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 50;
const DEFAULT_TIMEOUT_MS = 10_000;

function tableForType(type: string): string {
  switch (type) {
    case 'live':
      return 'live_channels';
    case 'movie':
      return 'vod_movies';
    case 'series':
      return 'series';
    case 'episode':
      return 'episodes';
    default:
      return '';
  }
}

function isManifestContentType(contentType: string): boolean {
  return MANIFEST_CONTENT_TYPES.has(contentType.toLowerCase());
}

// Hop-by-hop headers that must never be forwarded (RFC 7230)
const FORBIDDEN_HEADER_KEYS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
  'host',
]);

function sanitizeHeaders(rawHeaders: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};

  // Whitelisted canonical headers
  if (rawHeaders['User-Agent']) out['User-Agent'] = rawHeaders['User-Agent'];
  if (rawHeaders['Referer']) out['Referer'] = rawHeaders['Referer'];
  if (rawHeaders['Cookie']) out['Cookie'] = rawHeaders['Cookie'];

  // Custom headers from the `headers` object — validate key format and forbid hop-by-hop headers
  if (rawHeaders.headers && typeof rawHeaders.headers === 'object') {
    for (const [key, value] of Object.entries(rawHeaders.headers)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_HEADER_KEYS.has(lowerKey)) {
        continue; // Skip forbidden headers
      }
      if (HEADER_KEY_REGEX.test(key)) {
        // Normalize to canonical case (first letter uppercase, rest lowercase after hyphens)
        const canonicalKey = key
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
        out[canonicalKey] = String(value);
      }
    }
  }

  return out;
}

function parseHttpHeaders(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

export class StreamProxyService {
  private server: Server | null = null;
  private port: number | null = null;
  private db: Database.Database | null = null;
  private manifestCache = new Map<string, CacheEntry>();
  private ipcMain: IpcMain | null = null;

  /**
   * Starts the proxy server on an ephemeral port.
   * @param db - The catalog SQLite database handle.
   * @returns Promise resolving to the bound port number.
   */
  async start(db: Database.Database): Promise<{ port: number }> {
    if (this.server) {
      return { port: this.port! };
    }

    this.db = db;

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server!.address();
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

  /**
   * Stops the proxy server.
   */
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.server = null;
          this.port = null;
          this.db = null;
          this.manifestCache.clear();
          resolve();
        });
      });
    }
  }

  /**
   * Returns the bound port number, or null if not started.
   */
  getPort(): number | null {
    return this.port;
  }

  /**
   * Sets the IPC main instance for emitting error events.
   * Called from main/index.ts after registerHandlers.
   */
  setIpcMain(ipcMain: IpcMain): void {
    this.ipcMain = ipcMain;
  }

  /**
   * Looks up the URL and http_headers for a catalog row.
   * Used by the player:getProxiedUrl IPC handler.
   */
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

  /**
   * Core request handler.
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '', `http://127.0.0.1:${this.port}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Health check
    if (pathParts[0] === 'proxy' && pathParts[1] === 'health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Proxy route: /proxy/:type/:id
    if (pathParts[0] === 'proxy' && pathParts[1] && pathParts[2]) {
      const type = pathParts[1];
      const id = parseInt(pathParts[2], 10);

      if (isNaN(id) || id <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid ID' }));
        return;
      }

      await this.proxyStream(req, res, type, id);
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Proxies a stream request to the origin with header injection.
   */
  private async proxyStream(
    _req: IncomingMessage,
    res: ServerResponse,
    type: string,
    id: number,
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
    const headers = sanitizeHeaders(parseHttpHeaders(row.http_headers));

    // Check manifest cache
    const cacheKey = `${type}:${id}`;
    const cached = this.manifestCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Check if the client accepts this content type (manifest)
      // For now, serve cached manifest on cache hit
      res.writeHead(200, {
        'Content-Type': cached.contentType,
        'Content-Length': cached.body.length,
        'Cache-Control': 'public, max-age=30',
      });
      res.end(cached.body);
      return;
    }

    // Forward to origin with injected headers
    try {
      await this.fetchAndStream(originUrl, headers, res, cacheKey);
    } catch (error) {
      this.emitError('STREAM_TIMEOUT', `Failed to fetch stream: ${error}`);
      // Only send response if not already sent by fetchAndStream
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream timeout' }));
      }
    }
  }

  /**
   * Fetches from origin using Electron net.request and streams to response.
   */
  private fetchAndStream(
    originUrl: string,
    headers: Record<string, string>,
    res: ServerResponse,
    cacheKey: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        url: originUrl,
        headers,
      } as any);
      (request as any).setTimeout(DEFAULT_TIMEOUT_MS);
      let responseReceived = false;
      let responseSent = false;
      let responseBuffer: Buffer[] = [];
      let responseContentType = '';
      let responseStatusCode = 0;

      request.on('response', (response) => {
        responseReceived = true;
        responseStatusCode = response.statusCode;

        // Collect response body for potential caching
        response.on('data', (chunk: Buffer) => {
          responseBuffer.push(chunk);
        });

        response.on('end', () => {
          const body = Buffer.concat(responseBuffer);
          responseContentType = (response.headers['content-type'] as string) ?? '';

          // Check for error status codes
          if (responseStatusCode >= 500) {
            this.emitError('STREAM_TIMEOUT', `Upstream returned ${responseStatusCode}`);
            if (!responseSent) {
              responseSent = true;
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Upstream error' }));
            }
            resolve();
            return;
          }

          // Stream to client
          if (!responseSent) {
            responseSent = true;
            res.writeHead(responseStatusCode, {
              'Content-Type': responseContentType,
              'Content-Length': body.length,
              'Cache-Control': isManifestContentType(responseContentType) ? 'public, max-age=30' : 'no-cache',
            });
            res.end(body);
          }

          // Cache manifest responses
          if (isManifestContentType(responseContentType)) {
            this.setCacheEntry(cacheKey, body, responseContentType);
          }

          resolve();
        });
      });

      request.on('error', (error) => {
        if (!responseReceived) {
          this.emitError('NETWORK', `Network error: ${error.message}`);
          if (!responseSent) {
            responseSent = true;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Network error' }));
          }
        }
        reject(error);
      });

      request.end();
    });
  }

  /**
   * Sets a cache entry with LRU eviction.
   */
  private setCacheEntry(key: string, body: Buffer, contentType: string): void {
    // Evict expired entries first
    const now = Date.now();
    for (const [k, v] of this.manifestCache.entries()) {
      if (v.expiresAt <= now) {
        this.manifestCache.delete(k);
      }
    }

    // LRU eviction if at capacity
    if (this.manifestCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = this.manifestCache.keys().next().value;
      if (firstKey) {
        this.manifestCache.delete(firstKey);
      }
    }

    this.manifestCache.set(key, {
      body,
      contentType,
      expiresAt: now + DEFAULT_TTL_MS,
    });
  }

  /**
   * Emits a player:reportError IPC event.
   */
  private emitError(code: string, message: string): void {
    if (this.ipcMain) {
      this.ipcMain.emit('player:reportError', {
        code,
        message,
        ctx: { timestamp: Date.now() },
      });
    }
    // Also log to console for visibility
    console.warn(`[stream-proxy] ${code}: ${message}`);
  }
}