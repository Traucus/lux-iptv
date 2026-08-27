/**
 * E2E: routing — HashRouter + /watch/:type/:id placeholder.
 *
 * REQ-ROUTER-1: Deep links resolve under `file://` in packaged Electron. In
 * the dev server (Vite on http://localhost:5173) we still go through
 * HashRouter, which means a hash-fragment URL is what the browser hits.
 *
 * REQ-NAV-1: /watch/:type/:id renders the player placeholder with the parsed
 * type and id.
 *
 * REQ-NAV-2: /watch with an invalid type falls back to "/".
 */
import { test, expect } from '@playwright/test';

test.describe('HashRouter / watch route', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { luxAPI: unknown }).luxAPI = {
        ingest: { start: async () => ({ data: { jobId: 'job-route' } }), cancel: async () => ({ data: undefined }), getProgress: async () => ({ data: { phase: 'DONE', percent: 100, counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0 } } }), onProgress: () => () => undefined },
        catalog: { list: async () => ({ data: { items: [], total: 0 } }), getById: async () => ({ data: null }) },
        enrichment: { getStatus: async () => ({ data: { queueLength: 0, lastEnrichedAt: null, isRunning: false } }) },
        tmdb: { setKey: async () => ({ data: { valid: false } }), hasKey: async () => ({ data: false }), clearKey: async () => ({ data: undefined }) },
      };
    });
  });

  test('navigates to #/watch/movie/42 and renders the placeholder with type=movie id=42', async ({ page }) => {
    await page.goto('/#/watch/movie/42');

    await expect(page.getByTestId('player-placeholder')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('player-type')).toHaveText('type=movie');
    await expect(page.getByTestId('player-id')).toHaveText('id=42');
    await expect(page.getByTestId('player-message')).toHaveText(/Player coming in PR 5/i);
  });

  test('preserves the watch route across page reloads (HashRouter semantics)', async ({ page }) => {
    await page.goto('/#/watch/series/100');
    await expect(page.getByTestId('player-type')).toHaveText('type=series');

    // Reload — HashRouter should re-resolve the route from the URL hash.
    await page.reload();
    await expect(page.getByTestId('player-placeholder')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('player-type')).toHaveText('type=series');
    await expect(page.getByTestId('player-id')).toHaveText('id=100');
  });

  test('redirects to "/" when /watch/:type/:id has an invalid type', async ({ page }) => {
    await page.goto('/#/watch/invalid/42');

    // After redirect, the hash should land back at "/" — the home DashboardPage
    // renders a sidebar with the "Home" button visible.
    await expect(page.getByLabel('Home')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('player-placeholder')).toHaveCount(0);
  });
});
