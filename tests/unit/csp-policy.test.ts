// @vitest-environment node
/**
 * CSP policy test for src/renderer/index.html.
 *
 * REQ-CSP-1: `media-src 'self' blob:` allows local + blob-URL video playback.
 * REQ-CSP-2: `connect-src 'self'` allows fetch to the local stream proxy.
 * REQ-CSP-3: `worker-src 'self' blob:` allows web workers + ingestion workers.
 *
 * We read the index.html file from disk and parse the CSP meta tag. We assert
 * on individual directives rather than full-string equality so the policy can
 * evolve (extra sources appended, comments added) without breaking the test.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = path.resolve(here, '../../src/renderer/index.html');

let cspContent: string;

beforeAll(async () => {
  const html = await readFile(indexHtmlPath, 'utf8');
  // Match the CSP meta tag. The CSP content itself contains single quotes
  // (e.g. 'self'), so we can NOT use `["']` as the attribute delimiter in the
  // capture group — that would terminate the match at the first quote inside
  // the value. We assume index.html uses double-quoted attributes throughout
  // and capture everything between the outermost double quotes on `content=`.
  const match = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i);
  if (!match) {
    throw new Error(`Content-Security-Policy meta tag not found in ${indexHtmlPath}`);
  }
  cspContent = match[1];
});

/**
 * Parse a CSP content string into a map of directive → array of source tokens.
 * Tolerates extra whitespace and case-insensitive directive names.
 */
function parseCsp(content: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const raw of content.split(';')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const [name, ...sources] = trimmed.split(/\s+/);
    directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

function hasSource(sources: string[] | undefined, candidate: string): boolean {
  if (!sources) return false;
  return sources.some((s) => s.toLowerCase() === candidate.toLowerCase());
}

describe('Content-Security-Policy', () => {
  it('declares a default-src directive', () => {
    const directives = parseCsp(cspContent);
    expect(directives.has('default-src')).toBe(true);
  });

  it('default-src includes the self source', () => {
    const directives = parseCsp(cspContent);
    expect(hasSource(directives.get('default-src'), "'self'")).toBe(true);
  });

  it('declares script-src', () => {
    const directives = parseCsp(cspContent);
    expect(directives.has('script-src')).toBe(true);
  });

  it('does NOT enable unsafe-eval in script-src (security baseline)', () => {
    const directives = parseCsp(cspContent);
    expect(hasSource(directives.get('script-src'), "'unsafe-eval'")).toBe(false);
  });

  describe('REQ-CSP-1: media-src', () => {
    it('declares media-src', () => {
      const directives = parseCsp(cspContent);
      expect(directives.has('media-src')).toBe(true);
    });

    it("media-src includes 'self' source", () => {
      const directives = parseCsp(cspContent);
      expect(hasSource(directives.get('media-src'), "'self'")).toBe(true);
    });

    it('media-src includes blob: source (so blob URLs can play)', () => {
      const directives = parseCsp(cspContent);
      expect(hasSource(directives.get('media-src'), 'blob:')).toBe(true);
    });

    it('media-src allows the loopback stream proxy (any ephemeral port)', () => {
      const directives = parseCsp(cspContent);
      expect(hasSource(directives.get('media-src'), 'http://127.0.0.1:*')).toBe(true);
      expect(hasSource(directives.get('media-src'), 'http://localhost:*')).toBe(true);
    });
  });

  describe('REQ-CSP-2: connect-src', () => {
    it('declares connect-src', () => {
      const directives = parseCsp(cspContent);
      expect(directives.has('connect-src')).toBe(true);
    });

    it("connect-src includes 'self' source (so fetch to local proxy works)", () => {
      const directives = parseCsp(cspContent);
      expect(hasSource(directives.get('connect-src'), "'self'")).toBe(true);
    });
  });

  describe('REQ-CSP-3: worker-src', () => {
    it('declares worker-src', () => {
      const directives = parseCsp(cspContent);
      expect(directives.has('worker-src')).toBe(true);
    });

    it("worker-src includes 'self' source", () => {
      const directives = parseCsp(cspContent);
      expect(hasSource(directives.get('worker-src'), "'self'")).toBe(true);
    });

    it('worker-src includes blob: source (so blob-URL workers load)', () => {
      const directives = parseCsp(cspContent);
      expect(hasSource(directives.get('worker-src'), 'blob:')).toBe(true);
    });
  });

  describe('style-src', () => {
    it('declares style-src so inline styles from react-tv-space-navigation are not blocked', () => {
      const directives = parseCsp(cspContent);
      expect(directives.has('style-src')).toBe(true);
      expect(hasSource(directives.get('style-src'), "'self'")).toBe(true);
    });
  });
});
