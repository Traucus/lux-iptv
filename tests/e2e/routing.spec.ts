/**
 * E2E: routing — HashRouter + /watch/:type/:id PlayerPage.
 *
 * REQ-ROUTER-1: Deep links resolve under `file://` in packaged Electron. In
 * the dev server (Vite on http://localhost:5173) we still go through
 * HashRouter, which means a hash-fragment URL is what the browser hits.
 *
 * /watch/:type/:id mounts PlayerPage (video-player). Invalid type falls back to "/".
 */
import { test, expect } from '@playwright/test';

test.describe('HashRouter / watch route', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const movie = {
        id: 42,
        name: 'Movie',
        url: 'https://origin.example/stream.m3u8',
        groupTitle: null,
        cover: null,
        year: 2020,
        contentType: 'movie' as const,
        mediaFormat: 'hls' as const,
        httpHeaders: {},
      };

      (window as unknown as { luxAPI: unknown }).luxAPI = {
        ingest: {
          start: async () => ({ data: { jobId: 'job-route' } }),
          cancel: async () => ({ data: undefined }),
          getProgress: async () => ({ data: { phase: 'DONE', percent: 100, counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0 } } }),
          onProgress: () => () => undefined,
        },
        catalog: {
          list: async () => ({ data: { items: [], total: 0 } }),
          getById: async (input: { type: string; id: number }) => {
            if (input.type === 'movie' && input.id === 42) {
              return { data: movie };
            }
            if (input.type === 'series' && input.id === 100) {
              return {
                data: {
                  series: { ...movie, id: 100, name: 'Series', contentType: 'series' },
                  seasons: [{
                    seasonNumber: 1,
                    episodes: [
                      { id: 101, seriesId: 100, name: 'E1', url: 'https://origin.example/ep101.m3u8', season: 1, episode: 1, cover: null, addedAt: 0 },
                    ],
                  }],
                },
              };
            }
            return { data: null };
          },
        },
        enrichment: { getStatus: async () => ({ data: { queueLength: 0, lastEnrichedAt: null, isRunning: false } }) },
        tmdb: { setKey: async () => ({ data: { valid: false } }), hasKey: async () => ({ data: false }), clearKey: async () => ({ data: undefined }) },
        player: {
          getSource: async (i: { type: string; id: number }) => ({ data: { type: i.type, id: i.id, mediaFormat: 'hls' } }),
          getProxiedUrl: async (i: { type: string; id: number }) => ({ data: { url: `http://127.0.0.1:9/proxy/${i.type}/${i.id}` } }),
          reportError: async () => ({ data: undefined }),
          reportProgress: async () => ({ data: undefined }),
          getNextEpisode: async () => ({ data: null }),
        },
        config: { hasSource: async () => ({ data: { configured: false } }) },
      };
    });
  });

  test('navigates to #/watch/movie/42 and renders video-player', async ({ page }) => {
    await page.goto('http://localhost:5173/#/watch/movie/42');

    await expect(page.getByTestId('video-player')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('player-placeholder')).toHaveCount(0);
    await expect(page.getByTestId('player-error')).toHaveCount(0);
  });

  test('preserves the watch route across page reloads (HashRouter semantics)', async ({ page }) => {
    await page.goto('http://localhost:5173/#/watch/series/100');
    await expect(page.getByTestId('video-player')).toBeVisible({ timeout: 5000 });

    // Reload — HashRouter should re-resolve the route from the URL hash.
    await page.reload();
    await expect(page.getByTestId('video-player')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('player-placeholder')).toHaveCount(0);
    await expect(page.getByTestId('player-error')).toHaveCount(0);
  });

  test('redirects to "/" when /watch/:type/:id has an invalid type', async ({ page }) => {
    await page.goto('http://localhost:5173/#/watch/invalid/42');

    // After redirect, the hash should land back at "/" — the home DashboardPage
    // renders a sidebar with the "Home" button visible.
    await expect(page.getByLabel('Home')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('player-placeholder')).toHaveCount(0);
  });
});
