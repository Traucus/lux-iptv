/**
 * E2E: degraded-mode
 *
 * Verifies that the app renders correctly without a configured TMDB key —
 * dashboard carousels still show with placeholders, detail views show raw names.
 */
import { test, expect } from '@playwright/test';

test.describe('degraded-mode flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const items = [
        { id: 1, name: 'Raw Title 1', url: 'http://x/1', groupTitle: 'Movies', cover: null, year: null },
        { id: 2, name: 'Raw Title 2', url: 'http://x/2', groupTitle: 'Movies', cover: null, year: null },
        { id: 3, name: 'Raw Series', url: 'http://x/3', groupTitle: 'Drama', cover: null, year: null },
      ];

      (window as unknown as { luxAPI: unknown }).luxAPI = {
        ingest: { start: async () => ({ data: { jobId: 'job-1' } }), cancel: async () => ({ data: undefined }), getProgress: async () => ({ data: { phase: 'DONE', percent: 100, counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0 } } }), onProgress: () => () => undefined },
        catalog: {
          list: async (input: { type: string }) => {
            if (input.type === 'movie') return { data: { items: items.filter((i) => i.groupTitle === 'Movies'), total: 2 } };
            if (input.type === 'series') return { data: { items: items.filter((i) => i.name === 'Raw Series'), total: 1 } };
            return { data: { items: [], total: 0 } };
          },
          getById: async (input: { type: string; id: number }) => ({
            data: items.find((i) => i.id === input.id) ?? null,
          }),
        },
        enrichment: { getStatus: async () => ({ data: { queueLength: 0, lastEnrichedAt: null, isRunning: false } }) },
        tmdb: {
          setKey: async () => ({ data: { valid: false } }),
          hasKey: async () => ({ data: false }), // No TMDB key configured
          clearKey: async () => ({ data: undefined }),
        },
      };
    });
  });

  test('dashboard renders without TMDB key (placeholders, no errors)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    // Dashboard renders sidebar
    await expect(page.getByLabel('Home')).toBeVisible();

    // Movie carousel shows raw names
    await expect(page.getByText('Raw Title 1').first()).toBeVisible({ timeout: 5000 });

    // No TMDB enrichment calls are made — hasKey returns false
    // No errors logged from missing data
    const tmdbErrors = errors.filter((e) => /TMDB|tmdb/.test(e));
    expect(tmdbErrors).toEqual([]);
  });

  test('movie detail renders raw name + degraded indicator', async ({ page }) => {
    await page.goto('/#/content/movie/1');

    // Raw name as title
    await expect(page.getByRole('heading', { name: 'Raw Title 1', level: 1 })).toBeVisible({ timeout: 5000 });

    // Degraded indicator
    await expect(page.getByText(/No enriched metadata available/i).first()).toBeVisible();
  });

  test('series detail season tabs work without enrichment', async ({ page }) => {
    // Series detail is addressed by type in the URL, not by a magic id range.
    await page.addInitScript(() => {
      const originalLux = (window as unknown as { luxAPI: { catalog: { getById: unknown } } }).luxAPI;
      (window as unknown as { luxAPI: unknown }).luxAPI = {
        ...originalLux,
        catalog: {
          ...originalLux.catalog,
          getById: async (input: { type: string; id: number }) => {
            if (input.type === 'series') {
              return {
                data: {
                  series: { id: 3, name: 'Raw Series', url: 'http://x/3', groupTitle: 'Drama', cover: null, year: null },
                  seasons: [
                    { seasonNumber: 1, episodes: [{ id: 10, name: 'S1E1', url: 'http://x/s1e1', groupTitle: null, cover: null, year: null }] },
                    { seasonNumber: 2, episodes: [{ id: 20, name: 'S2E1', url: 'http://x/s2e1', groupTitle: null, cover: null, year: null }] },
                  ],
                },
              };
            }
            return { data: null };
          },
        },
      };
    });

    await page.goto('/#/content/series/3');

    await expect(page.getByRole('heading', { name: 'Raw Series', level: 1 })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: /Season 1/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Season 2/i })).toBeVisible();

    // Switching seasons still works without enrichment
    await page.getByRole('tab', { name: /Season 2/i }).click();
    await expect(page.getByText(/Ep\. 2 — S2E1/)).toBeVisible();
  });
});
