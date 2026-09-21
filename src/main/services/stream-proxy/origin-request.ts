import { IncomingMessage, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';

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
