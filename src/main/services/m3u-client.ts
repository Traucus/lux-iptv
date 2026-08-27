import { parsePlaylist } from 'iptv-m3u-playlist-parser';
import * as fs from 'fs';
import * as path from 'path';
import type { MediaFormat } from '../../shared/types/player';

/**
 * HTTP request hints captured from M3U `Entry.http` (EXTVLCOPT).
 * Mirrors the shape exposed by `iptv-m3u-playlist-parser` v0.3+.
 */
export interface M3UEntryHttpHints {
  userAgent?: string;
  referer?: string;
  cookie?: string;
  headers?: Record<string, string>;
}

export interface M3UEntry {
  name: string;
  url: string;
  groupTitle: string | null;
  tvgId: string | null;
  tvgLogo: string | null;
  /**
   * HTTP request hints parsed from `#EXTVLCOPT:http-user-agent=…`,
   * `#EXTVLCOPT:http-referer=…`, `#EXTVLCOPT:http-cookie=…`.
   * `null` when no EXTVLCOPT http directives are present.
   */
  http: M3UEntryHttpHints | null;
  /**
   * Media container/format detected from the URL extension.
   * Drives engine selection in the renderer (hls.js vs native <video>).
   */
  mediaFormat: MediaFormat;
}

const ALLOWED_EXTENSIONS = ['.m3u', '.m3u8'];
const DEFAULT_TIMEOUT_MS = 15000;

interface FetchOptions {
  timeoutMs?: number;
}

/**
 * Detects the media container/format from a stream URL.
 *
 * Mapping (see design §G2 — detectMediaFormat):
 *   .m3u8 → hls
 *   .mp4  → mp4
 *   .mpd  → dash
 *   .ts   → ts
 *   any other / no extension → unknown
 *
 * Query strings and fragments are stripped before matching. Case-insensitive.
 */
export function detectMediaFormat(url: string): MediaFormat {
  // Resolve relative URLs against a synthetic base; pathname extraction strips
  // the query/fragment automatically. `new URL` throws on invalid input; the
  // parser only feeds well-formed URLs, but we guard defensively.
  let pathname: string;
  try {
    pathname = new URL(url, 'http://x.invalid').pathname;
  } catch {
    return 'unknown';
  }
  const ext = pathname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  switch (ext) {
    case '.m3u8':
      return 'hls';
    case '.mp4':
      return 'mp4';
    case '.mpd':
      return 'dash';
    case '.ts':
      return 'ts';
    default:
      return 'unknown';
  }
}

/**
 * Fetches and parses an M3U playlist from a remote URL.
 */
export async function fetchM3U(url: string, options?: FetchOptions): Promise<M3UEntry[]> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: Failed to fetch M3U`);
    }
    const text = await response.text();
    return parseM3UText(text);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`CONNECTION_ERROR: Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reads and parses a local M3U file.
 * Validates that the file is within the allowed directory and has a valid extension.
 */
export async function readLocalM3U(filePath: string, allowedDir: string): Promise<M3UEntry[]> {
  // Resolve both paths to absolute
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(allowedDir);

  // Check the file is within the allowed directory
  if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
    throw new Error(`INVALID_INPUT: File path is outside allowed directory`);
  }

  // Check extension
  const ext = path.extname(resolvedFile).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`INVALID_INPUT: Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  const text = fs.readFileSync(resolvedFile, 'utf8');
  return parseM3UText(text);
}

/**
 * True when the parser-emitted `http` object carries at least one populated
 * hint. The library always emits `{ headers: {} }` when no EXTVLCOPT was seen,
 * so we can't rely on presence/absence — we have to check the meaningful fields.
 */
function hasHttpHints(http: { userAgent?: string; referer?: string; cookie?: string; headers?: Record<string, string> } | undefined): boolean {
  if (!http) return false;
  if (http.userAgent) return true;
  if (http.referer) return true;
  if (http.cookie) return true;
  if (http.headers && Object.keys(http.headers).length > 0) return true;
  return false;
}

function parseM3UText(text: string): M3UEntry[] {
  const playlist = parsePlaylist(text);
  const entries: M3UEntry[] = [];

  for (const item of playlist.items) {
    // Skip entries without a name or URL
    if (!item.name || !item.url) {
      continue;
    }

    entries.push({
      name: item.name,
      url: item.url,
      groupTitle: item.group?.[0] ?? null,
      tvgId: item.tvg?.id ?? null,
      tvgLogo: item.tvg?.logo ?? null,
      // The parser populates `item.http` with an empty `{ headers: {} }` object
      // even when no EXTVLCOPT was provided. Normalize to `null` in that case
      // so callers can distinguish "no hints" from "real hints".
      http: hasHttpHints(item.http) ? item.http! : null,
      mediaFormat: detectMediaFormat(item.url),
    });
  }

  return entries;
}
