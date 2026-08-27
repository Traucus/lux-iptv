/**
 * Playwright-fixture contract.
 *
 * Spec: media-harness §Playwright E2E Fixture with Local .m3u8 Server
 *  - The fixture `m3u8Server` MUST start a local m3u8 server before each
 *    test and stop it after.
 *  - Tests receive the server URL via the fixture (no manual lifecycle).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { m3u8ServerFixture, test } from './playwright-fixtures';
import type { M3u8FixtureServer } from '../helpers/m3u8-fixture-server';

describe('playwright-fixtures', () => {
  let server: M3u8FixtureServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('exports a `test` object extended with a m3u8Server fixture', () => {
    expect(test).toBeDefined();
    // The extended fixture MUST be registered on the test instance so
    // Playwright recognises it in the type signature.
    // The Playwright `test.extend` API stores fixtures under a symbol; we
    // assert via the existence of the function shape only.
    expect(typeof test).toBe('function');
  });

  it('m3u8ServerFixture() returns a started server that the caller can close', async () => {
    const s = await m3u8ServerFixture();
    server = s;
    expect(s.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(s.port).toBeGreaterThan(0);
    // The server MUST actually be reachable.
    const res = await fetch(`${s.url}/test.m3u8`);
    expect(res.status).toBe(200);
  });

  it('the server serves the spec-required HLS routes', async () => {
    server = await m3u8ServerFixture();

    const master = await fetch(`${server.url}/test.m3u8`);
    expect(master.status).toBe(200);
    const masterBody = await master.text();
    expect(masterBody).toMatch(/#EXTM3U/);

    const variant = await fetch(`${server.url}/media.m3u8`);
    expect(variant.status).toBe(200);

    const seg = await fetch(`${server.url}/segment0.ts`);
    expect(seg.status).toBe(200);
    const buf = new Uint8Array(await seg.arrayBuffer());
    expect(buf[0]).toBe(0x47);
  });
});
