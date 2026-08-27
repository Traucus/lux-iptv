/**
 * Playwright fixtures for player E2E tests.
 *
 * Spec: media-harness §Playwright E2E Fixture with Local .m3u8 Server
 *
 * Exposes a `m3u8Server` fixture that:
 *  - Starts a local HTTP server on 127.0.0.1 with an ephemeral port
 *    before the test body runs.
 *  - Yields the server (with `url`, `port`, `close`) to the test.
 *  - Tears the server down after the test body resolves or rejects.
 *
 * Usage from a Playwright spec:
 *   import { test, expect } from './tests/fixtures/playwright-fixtures';
 *   test('player loads m3u8', async ({ page, m3u8Server }) => {
 *     await page.goto(m3u8Server.url + '/test.m3u8');
 *     expect(...).toBe(...);
 *   });
 */
import { test as base, type TestFixture } from '@playwright/test';
import { startM3u8FixtureServer, type M3u8FixtureServer } from '../helpers/m3u8-fixture-server';

export type M3u8ServerFixture = M3u8FixtureServer;

/**
 * Standalone lifecycle hook (mirrors what Playwright does internally).
 * Exported for Vitest-side smoke tests (see `playwright-fixtures.test.ts`).
 */
export async function m3u8ServerFixture(): Promise<M3u8FixtureServer> {
  return startM3u8FixtureServer();
}

const fixture: TestFixture<M3u8ServerFixture, {}> = async ({}, use) => {
  const server = await startM3u8FixtureServer();
  try {
    await use(server);
  } finally {
    await server.close();
  }
};

export const test = base.extend<{ m3u8Server: M3u8ServerFixture }>({
  m3u8Server: fixture,
});

export { expect } from '@playwright/test';
