/**
 * E2E: ingest-to-dashboard
 *
 * Launches the app, navigates to /ingest, submits a valid M3U URL,
 * waits for the ingestion overlay to appear, then verifies the dashboard
 * renders content carousels after DONE.
 *
 * Notes:
 * - This test uses Playwright Chromium against the Vite dev server (per existing
 *   playwright.config.ts). To run against Electron, add an Electron project and
 *   use `_electron.launch()` (out of scope for this PR3 slice).
 * - Network access is stubbed at the IPC layer via the dev server's mock.
 */
import { test, expect } from '@playwright/test';

test.describe('ingest-to-dashboard flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the IPC bridge before the app loads
    await page.addInitScript(() => {
      type CatalogItem = { id: number; name: string; url: string; groupTitle: string | null; cover: string | null; year: number | null; enrichmentStatus: 'pending' | 'enriched' | 'not_found' | 'error' };

      const fakeItems: CatalogItem[] = [
        { id: 1, name: 'Inception', url: 'http://x/1', groupTitle: 'Drama', cover: null, year: 2010, enrichmentStatus: 'enriched' },
        { id: 2, name: 'Breaking Bad', url: 'http://x/2', groupTitle: 'Drama', cover: null, year: 2008, enrichmentStatus: 'enriched' },
        { id: 3, name: 'CNN', url: 'http://x/3', groupTitle: 'News', cover: null, year: null, enrichmentStatus: 'pending' },
      ];

      (window as unknown as { luxAPI: unknown }).luxAPI = {
        ingest: {
          start: async () => ({ data: { jobId: 'job-test' } }),
          cancel: async () => ({ data: undefined }),
          getProgress: async () => ({ data: { phase: 'DONE', percent: 100, counts: { live: 1, movies: 1, series: 1, radio: 0, total: 3 } } }),
          onProgress: (_cb: unknown) => () => undefined,
        },
        catalog: {
          list: async (input: { type: string }) => ({
            data: {
              items: fakeItems.filter((i) => {
                if (input.type === 'live') return i.name === 'CNN';
                if (input.type === 'movie') return i.name === 'Inception';
                if (input.type === 'series') return i.name === 'Breaking Bad';
                return false;
              }),
              total: 1,
            },
          }),
          getById: async (input: { type: string; id: number }) => ({
            data: fakeItems.find((i) => i.id === input.id) ?? null,
          }),
        },
        enrichment: { getStatus: async () => ({ data: { queueLength: 0, lastEnrichedAt: null, isRunning: false } }) },
        tmdb: { setKey: async () => ({ data: { valid: true } }), hasKey: async () => ({ data: false }), clearKey: async () => ({ data: undefined }) },
      };
    });
  });

  test('user can submit M3U URL and reach dashboard', async ({ page }) => {
    await page.goto('/ingest');

    // Fill the M3U URL field
    const urlInput = page.locator('#cf-url');
    await urlInput.fill('https://example.com/playlist.m3u');

    // Fill the list name
    const listNameInput = page.locator('#cf-listname');
    await listNameInput.fill('My List');

    // Submit
    await page.getByRole('button', { name: /Start Ingestion/i }).click();

    // The progress overlay should appear (dialog with role)
    await expect(page.getByRole('dialog', { name: /Ingestion progress/i })).toBeVisible({ timeout: 5000 });

    // Wait for redirect to dashboard (overlay disappears after 2s on DONE)
    await page.waitForURL('/', { timeout: 5000 });

    // Dashboard renders the sidebar
    await expect(page.getByLabel('Home')).toBeVisible();
    await expect(page.getByLabel('Movies')).toBeVisible();

    // Movie carousel should contain Inception
    await expect(page.getByText('Inception').first()).toBeVisible({ timeout: 5000 });
  });
});
