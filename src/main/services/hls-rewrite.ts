export interface HlsRewriteContext {
  type: string;
  id: number;
  originUrl: string;
}

const URI_TAGS = ['#EXT-X-KEY', '#EXT-X-MAP', '#EXT-X-MEDIA'] as const;

export function resolveSameOriginHttp(candidate: string, originUrl: string): string | null {
  try {
    const origin = new URL(originUrl);
    const resolved = new URL(candidate, originUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    if (resolved.origin !== origin.origin) return null;
    return resolved.href;
  } catch {
    return null;
  }
}

function toProxyUri(uri: string, ctx: HlsRewriteContext): string {
  if (/^https?:\/\//i.test(uri)) return uri;
  const resolved = resolveSameOriginHttp(uri, ctx.originUrl);
  if (!resolved) return uri;
  return `/proxy/${ctx.type}/${ctx.id}?u=${encodeURIComponent(resolved)}`;
}

export function rewritePlaylist(playlist: string, ctx: HlsRewriteContext): string {
  return playlist
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (URI_TAGS.some((tag) => trimmed.startsWith(tag))) {
        return line.replace(/URI=("?)([^",\s]+)\1/i, (_m, quote: string, uri: string) => {
          return `URI=${quote}${toProxyUri(uri, ctx)}${quote}`;
        });
      }
      if (!trimmed || trimmed.startsWith('#')) return line;
      return toProxyUri(trimmed, ctx);
    })
    .join('\n');
}
