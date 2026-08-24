import { parsePlaylist } from 'iptv-m3u-playlist-parser';
import * as fs from 'fs';
import * as path from 'path';

export interface M3UEntry {
  name: string;
  url: string;
  groupTitle: string | null;
  tvgId: string | null;
  tvgLogo: string | null;
}

const ALLOWED_EXTENSIONS = ['.m3u', '.m3u8'];
const DEFAULT_TIMEOUT_MS = 15000;

interface FetchOptions {
  timeoutMs?: number;
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
    });
  }

  return entries;
}
