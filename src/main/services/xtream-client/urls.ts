import { isUsableDirectSource } from '../m3u-client.js';
import type { HonestStreamUrlInput, XtreamCredentials } from './types.js';

export function normalizeContainerExtension(ext: string | null | undefined): string {
  return (ext ?? '').trim().replace(/^\./, '').toLowerCase();
}

export function buildHonestStreamUrl(input: HonestStreamUrlInput): string {
  if (isUsableDirectSource(input.directSource)) {
    return (input.directSource ?? '').trim();
  }

  const base = input.server.replace(/\/+$/, '');
  const ext = normalizeContainerExtension(input.containerExtension);
  const pathType = input.type === 'live' ? 'live' : input.type === 'movie' ? 'movie' : 'series';

  if (input.type === 'live') {
    if (ext && ext !== 'm3u8') {
      return `${base}/live/${input.username}/${input.password}/${input.streamId}.${ext}`;
    }
    return `${base}/live/${input.username}/${input.password}/${input.streamId}.m3u8`;
  }

  if (!ext) {
    return `${base}/${pathType}/${input.username}/${input.password}/${input.streamId}`;
  }
  return `${base}/${pathType}/${input.username}/${input.password}/${input.streamId}.${ext}`;
}

/** Xtream series stream URLs are `/series/user/pass/{seriesId}.ext`. */
export function parseXtreamSeriesId(url: string): number | null {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/series\/[^/]+\/[^/]+\/(\d+)/i);
    if (!match?.[1]) return null;
    const id = Number(match[1]);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function xtreamEpisodeUrl(
  credentials: XtreamCredentials,
  streamId: number,
  extension: string,
): string {
  return buildHonestStreamUrl({
    server: credentials.server,
    type: 'series',
    username: credentials.username,
    password: credentials.password,
    streamId,
    containerExtension: extension,
  });
}
