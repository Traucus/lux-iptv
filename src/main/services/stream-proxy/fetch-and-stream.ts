import type { ServerResponse } from 'node:http';
import { rewritePlaylist } from '../hls-rewrite.js';
import { looksLikeManifest } from './manifest-cache.js';
import type { OriginRequestFactory } from './origin-request.js';

const DEFAULT_TIMEOUT_MS = 10_000;

export type FetchAndStreamDeps = {
  createOriginRequest: OriginRequestFactory;
  emitError: (code: string, message: string) => void;
  setCacheEntry: (key: string, body: Buffer, contentType: string) => void;
};

export function fetchAndStream(
  originUrl: string,
  headers: Record<string, string>,
  res: ServerResponse,
  cacheKey: string,
  rewriteCtx: { type: string; id: number },
  deps: FetchAndStreamDeps,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = deps.createOriginRequest({
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
          deps.emitError('STREAM_TIMEOUT', `Upstream returned ${status}`);
          finishClient(502, { error: 'Upstream error' });
          settle(() => resolve());
        });
        response.on('error', () => {
          deps.emitError('STREAM_TIMEOUT', `Upstream returned ${status}`);
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
        deps.setCacheEntry(cacheKey, body, type);
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
        deps.emitError('NETWORK', `Origin body error: ${error.message}`);
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
        deps.emitError('NETWORK', `Network error: ${error.message}`);
        finishClient(503, { error: 'Network error' });
        settle(() => resolve());
        return;
      }
      deps.emitError('NETWORK', `Network error: ${error.message}`);
      finishClient(502, { error: 'Upstream error' });
      settle(() => resolve());
    });

    request.end();
  });
}
