import { createServer, IncomingMessage, ServerResponse, Server, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IpcMain } from 'electron';
import type { SqlJsCompatDb } from '../db/sqljs-adapter.js';
import { URL } from 'node:url';
import { resolveSameOriginHttp, rewritePlaylist } from './hls-rewrite.js';

/**
 * StreamProxyService — In-process HTTP proxy for stream manifests and segments.
 *
 * Architecture (per design §G5):
 * - Binds to 127.0.0.1 on an ephemeral port inside the Electron main process.
 * - Uses Node's `createServer()` for the inbound HTTP server.
 * - Uses Node `http`/`https` for outbound fetches (header injection,
 *   redirect following up to 5 hops, 10s timeout). Chromium `net.request`
 *   treats Content-Length as fatal (`ERR_CONTENT_LENGTH_MISMATCH`) and can
 *   crash the main process mid-playback.
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
const MAX_ORIGIN_REDIRECTS = 5;

export interface OriginRequest {
  on(event: 'response', listener: (response: IncomingMessage) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  abort(): void;
  end(): void;
}

export type OriginRequestFactory = (opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
}) => OriginRequest;

export function createNodeOriginRequest(opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
}): OriginRequest {
  let current: { destroy: () => void } | null = null;
  let aborted = false;
  let started = false;
  const responseListeners: Array<(response: IncomingMessage) => void> = [];
  const errorListeners: Array<(error: Error) => void> = [];

  const fail = (error: Error) => {
    if (aborted) return;
    for (const listener of errorListeners) listener(error);
  };

  const open = (urlString: string, hops: number) => {
    if (aborted) return;
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch (error) {
      fail(error as Error);
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      fail(new Error(`Unsupported origin protocol: ${parsed.protocol}`));
      return;
    }
    const request = (parsed.protocol === 'https:' ? httpsRequest : httpRequest)(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        method: opts.method,
        headers: opts.headers,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location && hops < MAX_ORIGIN_REDIRECTS) {
          response.resume();
          let next: string;
          try {
            next = new URL(location, parsed).href;
          } catch (error) {
            fail(error as Error);
            return;
          }
          open(next, hops + 1);
          return;
        }
        for (const listener of responseListeners) listener(response);
      },
    );
    current = request;
    request.on('error', (error) => {
      if (aborted) return;
      fail(error);
    });
    request.end();
  };

  return {
    on(event, listener) {
      if (event === 'response') {
        responseListeners.push(listener as (response: IncomingMessage) => void);
      }
      if (event === 'error') {
        errorListeners.push(listener as (error: Error) => void);
      }
    },
    abort() {
      aborted = true;
      current?.destroy();
    },
    end() {
      if (started || aborted) return;
      started = true;
      open(opts.url, 0);
    },
  };
}

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
  const [rawType] = contentType.toLowerCase().split(';');
  return MANIFEST_CONTENT_TYPES.has((rawType ?? '').trim());
}

function looksLikeManifest(url: string, contentType: string): boolean {
  if (isManifestContentType(contentType)) return true;
  const ct = contentType.toLowerCase();
  if (ct.includes('mpegurl') || ct.includes('m3u8')) return true;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith('.m3u8') || path.endsWith('.m3u');
  } catch {
    return false;
  }
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
  private db: SqlJsCompatDb | null = null;
  private manifestCache = new Map<string, CacheEntry>();
  private ipcMain: IpcMain | null = null;

  constructor(private readonly createOriginRequest: OriginRequestFactory = createNodeOriginRequest) {}

  /**
   * Starts the proxy server on an ephemeral port.
   * @param db - The catalog SQLite database handle.
   * @returns Promise resolving to the bound port number.
   */
  async start(db: SqlJsCompatDb): Promise<{ port: number }> {
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

    // Proxy route: /proxy/:type/:id  (optional ?u= same-origin rewrite target)
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
    const range = _req.headers.range;
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
      await this.fetchAndStream(targetUrl, headers, res, cacheKey, { type, id });
    } catch (error) {
      this.emitError('STREAM_TIMEOUT', `Failed to fetch stream: ${error}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream timeout' }));
      }
    }
  }

  /**
   * Fetches from origin using Node http/https (not Chromium net.request).
   * Manifests are buffered and rewritten; segments are piped without a full buffer.
   */
  private fetchAndStream(
    originUrl: string,
    headers: Record<string, string>,
    res: ServerResponse,
    cacheKey: string,
    rewriteCtx: { type: string; id: number },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this.createOriginRequest({
        method: 'GET',
        url: originUrl,
        headers,
      });
      let responseReceived = false;
      let responseSent = false;
      let aborted = false;
      let settled = false;

      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        action();
      };

      const abortOrigin = () => {
        if (aborted) return;
        aborted = true;
        request.abort();
      };

      const timeoutHandle = setTimeout(() => {
        if (responseReceived || aborted) return;
        abortOrigin();
        settle(() => reject(new Error('Upstream timeout')));
      }, DEFAULT_TIMEOUT_MS);
      const clearFetchTimeout = () => clearTimeout(timeoutHandle);

      const finishClient = (status: number, body: Record<string, string>) => {
        if (!responseSent) {
          responseSent = true;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
          return;
        }
        if (!res.writableEnded) {
          res.end();
        }
      };

      res.on('close', () => {
        if (res.writableEnded) return;
        abortOrigin();
        settle(() => resolve());
      });

      request.on('response', (response) => {
        if (aborted) {
          response.resume();
          return;
        }
        responseReceived = true;
        clearFetchTimeout();
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers['content-type'] ?? '');

        if (status >= 500) {
          response.on('data', () => undefined);
          response.on('end', () => {
            this.emitError('STREAM_TIMEOUT', `Upstream returned ${status}`);
            finishClient(502, { error: 'Upstream error' });
            settle(() => resolve());
          });
          response.on('error', () => {
            this.emitError('STREAM_TIMEOUT', `Upstream returned ${status}`);
            finishClient(502, { error: 'Upstream error' });
            settle(() => resolve());
          });
          return;
        }

        let mode: 'manifest' | 'pipe' | 'peek' = looksLikeManifest(originUrl, contentType)
          ? 'manifest'
          : 'peek';
        const chunks: Buffer[] = [];

        const pipeExtras = (): Record<string, string | number> => {
          const extra: Record<string, string | number> = { 'Cache-Control': 'no-cache' };
          const contentLength = response.headers['content-length'];
          if (typeof contentLength === 'string' && contentLength.length > 0) {
            extra['Content-Length'] = contentLength;
          }
          const acceptRanges = response.headers['accept-ranges'];
          if (typeof acceptRanges === 'string' && acceptRanges.length > 0) {
            extra['Accept-Ranges'] = acceptRanges;
          }
          return extra;
        };

        const sendHead = (extra: Record<string, string | number> = {}) => {
          if (responseSent) return;
          responseSent = true;
          res.writeHead(status, { 'Content-Type': contentType, ...extra });
        };

        const finishManifest = () => {
          const rewritten = rewritePlaylist(Buffer.concat(chunks).toString('utf8'), {
            ...rewriteCtx,
            originUrl,
          });
          const body = Buffer.from(rewritten);
          const type = contentType || 'application/vnd.apple.mpegurl';
          sendHead({
            'Content-Type': type,
            'Content-Length': body.length,
            'Cache-Control': 'public, max-age=30',
          });
          res.end(body);
          this.setCacheEntry(cacheKey, body, type);
          settle(() => resolve());
        };

        response.on('data', (chunk: Buffer) => {
          if (aborted) return;
          if (mode === 'pipe') {
            sendHead(pipeExtras());
            res.write(chunk);
            return;
          }
          if (mode === 'peek') {
            if (chunk.toString('utf8', 0, Math.min(7, chunk.length)).startsWith('#EXTM3U')) {
              mode = 'manifest';
              chunks.push(chunk);
              return;
            }
            mode = 'pipe';
            sendHead(pipeExtras());
            res.write(chunk);
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => {
          if (aborted) {
            settle(() => resolve());
            return;
          }
          if (mode === 'manifest') {
            finishManifest();
            return;
          }
          sendHead(pipeExtras());
          res.end();
          settle(() => resolve());
        });

        response.on('error', (error: Error) => {
          if (aborted) {
            settle(() => resolve());
            return;
          }
          this.emitError('NETWORK', `Origin body error: ${error.message}`);
          finishClient(502, { error: 'Upstream error' });
          settle(() => resolve());
        });
      });

      request.on('error', (error) => {
        clearFetchTimeout();
        if (aborted) {
          settle(() => resolve());
          return;
        }
        if (!responseReceived) {
          this.emitError('NETWORK', `Network error: ${error.message}`);
          finishClient(503, { error: 'Network error' });
          settle(() => resolve());
          return;
        }
        this.emitError('NETWORK', `Network error: ${error.message}`);
        finishClient(502, { error: 'Upstream error' });
        settle(() => resolve());
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