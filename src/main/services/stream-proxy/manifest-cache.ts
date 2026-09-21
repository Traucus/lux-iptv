import { URL } from 'node:url';

export interface CacheEntry {
  body: Buffer;
  contentType: string;
  expiresAt: number;
}

const MANIFEST_CONTENT_TYPES = new Set([
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
]);

export const DEFAULT_TTL_MS = 30_000;
export const MAX_CACHE_ENTRIES = 50;

function isManifestContentType(contentType: string): boolean {
  const [rawType] = contentType.toLowerCase().split(';');
  return MANIFEST_CONTENT_TYPES.has((rawType ?? '').trim());
}

export function looksLikeManifest(url: string, contentType: string): boolean {
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

export function setCacheEntry(
  cache: Map<string, CacheEntry>,
  key: string,
  body: Buffer,
  contentType: string,
): void {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt <= now) {
      cache.delete(k);
    }
  }

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }

  cache.set(key, {
    body,
    contentType,
    expiresAt: now + DEFAULT_TTL_MS,
  });
}
