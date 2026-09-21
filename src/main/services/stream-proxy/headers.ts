const HEADER_KEY_REGEX = /^[A-Za-z0-9-]+$/;

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

export function sanitizeHeaders(rawHeaders: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};

  if (rawHeaders['User-Agent']) out['User-Agent'] = rawHeaders['User-Agent'];
  if (rawHeaders['Referer']) out['Referer'] = rawHeaders['Referer'];
  if (rawHeaders['Cookie']) out['Cookie'] = rawHeaders['Cookie'];

  if (rawHeaders.headers && typeof rawHeaders.headers === 'object') {
    for (const [key, value] of Object.entries(rawHeaders.headers)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_HEADER_KEYS.has(lowerKey)) {
        continue;
      }
      if (HEADER_KEY_REGEX.test(key)) {
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

export function parseHttpHeaders(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

export function tableForType(type: string): string {
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
