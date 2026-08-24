import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { XtreamClient } from '../../src/main/services/xtream-client';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('xtream-client', () => {
  const baseUrl = 'https://xtream.example.com';
  const username = 'testuser';
  const password = 'testpass';

  describe('authentication', () => {
    it('authenticates successfully with valid credentials', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('username') === username && url.searchParams.get('password') === password) {
            return HttpResponse.json({
              user_info: { auth: 1, status: 'Active' },
              server_info: { url: baseUrl, port: 8080 },
            });
          }
          return HttpResponse.json({ user_info: { auth: 0 } }, { status: 401 });
        }),
      );

      const client = new XtreamClient({ baseUrl, username, password });
      const result = await client.login();
      expect(result.auth).toBe(1);
    });

    it('throws AUTH_FAILED on invalid credentials', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, () => {
          return HttpResponse.json({ user_info: { auth: 0 } }, { status: 401 });
        }),
      );

      const client = new XtreamClient({ baseUrl, username: 'bad', password: 'bad' });
      await expect(client.login()).rejects.toThrow(/AUTH_FAILED/i);
    });

    it('throws CONNECTION_ERROR on timeout', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, async () => {
          // Simulate a very slow response
          await new Promise((resolve) => setTimeout(resolve, 20000));
          return HttpResponse.json({});
        }),
      );

      const client = new XtreamClient({ baseUrl, username, password, timeoutMs: 100 });
      await expect(client.login()).rejects.toThrow(/CONNECTION_ERROR|timeout/i);
    });
  });

  describe('categories', () => {
    it('fetches live categories', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('action') === 'get_live_categories') {
            return HttpResponse.json([
              { category_id: '1', category_name: 'News' },
              { category_id: '2', category_name: 'Sports' },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const client = new XtreamClient({ baseUrl, username, password });
      const categories = await client.getLiveCategories();
      expect(categories).toHaveLength(2);
      expect(categories[0]).toEqual({ categoryId: '1', categoryName: 'News' });
    });

    it('fetches VOD categories', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('action') === 'get_vod_categories') {
            return HttpResponse.json([
              { category_id: '10', category_name: 'Action' },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const client = new XtreamClient({ baseUrl, username, password });
      const categories = await client.getVODCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].categoryName).toBe('Action');
    });

    it('fetches series categories', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('action') === 'get_series_categories') {
            return HttpResponse.json([
              { category_id: '20', category_name: 'Drama' },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const client = new XtreamClient({ baseUrl, username, password });
      const categories = await client.getSeriesCategories();
      expect(categories).toHaveLength(1);
    });
  });

  describe('streams', () => {
    it('fetches live streams by category', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('action') === 'get_live_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'CNN',
                stream_type: 'live',
                stream_id: 100,
                stream_icon: 'https://example.com/cnn.png',
                category_id: '1',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const client = new XtreamClient({ baseUrl, username, password });
      const streams = await client.getLiveStreams('1');
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('CNN');
      expect(streams[0].streamId).toBe(100);
    });

    it('fetches VOD streams by category', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('action') === 'get_vod_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Avatar',
                stream_type: 'movie',
                stream_id: 200,
                category_id: '10',
                rating: '8.5',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const client = new XtreamClient({ baseUrl, username, password });
      const streams = await client.getVODStreams('10');
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('Avatar');
    });

    it('fetches series streams by category', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('action') === 'get_series') {
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

      const client = new XtreamClient({ baseUrl, username, password });
      const streams = await client.getSeriesStreams('20');
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('Breaking Bad');
    });
  });

  describe('HTTPS enforcement', () => {
    it('rejects non-HTTPS URLs', () => {
      expect(() => new XtreamClient({
        baseUrl: 'http://insecure.example.com',
        username,
        password,
      })).toThrow(/HTTPS/i);
    });
  });
});
