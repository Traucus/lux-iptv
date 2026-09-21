import type { M3UEntryHttpHints } from '../m3u-client.js';

export function buildUrl(server: string, params: Record<string, string>): string {
  const base = server.replace(/\/+$/, '');
  const qs = new URLSearchParams(params).toString();
  return `${base}/player_api.php?${qs}`;
}

/**
 * Extracts HTTP header hints from a raw Xtream API stream object.
 * The API returns `user_agent` and `referer` fields per stream when the
 * operator has configured custom headers. Returns `null` when no header
 * fields are present.
 */
export function extractHttpHints(raw: {
  user_agent?: unknown;
  referer?: unknown;
}): M3UEntryHttpHints | null {
  const userAgent = typeof raw.user_agent === 'string' ? raw.user_agent : undefined;
  const referer = typeof raw.referer === 'string' ? raw.referer : undefined;
  if (!userAgent && !referer) return null;
  const hints: M3UEntryHttpHints = {};
  if (userAgent) hints.userAgent = userAgent;
  if (referer) hints.referer = referer;
  return hints;
}

export async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: ${text.substring(0, 200)}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`PARSE_ERROR: Response is not JSON (${text.substring(0, 100)})`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`CONNECTION_ERROR: Xtream API timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
