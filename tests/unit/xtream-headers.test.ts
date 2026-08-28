import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchXtreamLive, fetchXtreamVod, fetchXtreamSeries } from '../../src/main/services/xtream-client';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Xtream Codes API returns per-stream header metadata when the operator has
 * configured custom referers / user-agents per source. Some providers omit
 * those fields entirely — the client must default to `null` in that case.
 *
 * Header capture applies to BOTH live and VOD streams. The Xtream series
 * stream (which has no URL — series are containers for episodes) is unaffected
 * and is included here as a regression guard.
 */

const baseUrl = 'https://xtream.example.com';
const username = 'testuser';
const password = 'testpass';

describe('xtream-client — http header capture', () => {
  describe('live streams', () => {
    it('captures http headers when API returns user_agent and referer', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_live_categories') return HttpResponse.json([]);
          if (action === 'get_live_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'CNN',
                stream_type: 'live',
                stream_id: 100,
                stream_icon: 'https://example.com/cnn.png',
                category_id: '1',
                user_agent: 'CustomUA/1.0',
                referer: 'https://ref.example.com',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamLive({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].http).toEqual({
        userAgent: 'CustomUA/1.0',
        referer: 'https://ref.example.com',
      });
    });

    it('returns null http when API omits header fields', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_live_categories') return HttpResponse.json([]);
          if (action === 'get_live_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'BBC',
                stream_type: 'live',
                stream_id: 200,
                category_id: '1',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamLive({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].http).toBeNull();
    });

    it('captures only user_agent when only that field is present', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_live_categories') return HttpResponse.json([]);
          if (action === 'get_live_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'ESPN',
                stream_type: 'live',
                stream_id: 300,
                category_id: '1',
                user_agent: 'OnlyUA/2.0',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamLive({ server: baseUrl, username, password });
      expect(streams[0].http).toEqual({ userAgent: 'OnlyUA/2.0' });
    });
  });

  describe('VOD streams', () => {
    it('captures http headers when API returns user_agent and referer', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_vod_categories') return HttpResponse.json([]);
          if (action === 'get_vod_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Avatar',
                stream_type: 'movie',
                stream_id: 200,
                category_id: '10',
                rating: '8.5',
                user_agent: 'MovieUA/1.0',
                referer: 'https://movie-ref.example.com',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamVod({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].http).toEqual({
        userAgent: 'MovieUA/1.0',
        referer: 'https://movie-ref.example.com',
      });
    });

    it('returns null http when API omits header fields', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_vod_categories') return HttpResponse.json([]);
          if (action === 'get_vod_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Generic Movie',
                stream_type: 'movie',
                stream_id: 999,
                category_id: '10',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamVod({ server: baseUrl, username, password });
      expect(streams[0].http).toBeNull();
    });
  });

  describe('series streams (no http headers — series are containers)', () => {
    it('returns series without http headers (regression guard)', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_series_categories') return HttpResponse.json([]);
          if (action === 'get_series') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Breaking Bad',
                series_id: 300,
                category_id: '20',
                cover: 'https://example.com/bb.jpg',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamSeries({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('Breaking Bad');
      // Series fallback entry has no http headers
      expect(streams[0].http).toBeNull();
    });
  });
});
