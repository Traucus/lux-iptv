import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  xtreamAuth,
  fetchXtreamLive,
  fetchXtreamVod,
  fetchXtreamSeries,
  buildHonestStreamUrl,
} from '../../src/main/services/xtream-client';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const baseUrl = 'https://xtream.example.com';
const username = 'testuser';
const password = 'testpass';

describe('xtream-client', () => {
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

      const result = await xtreamAuth({ server: baseUrl, username, password });
      expect(result.userInfo).toBeDefined();
    });

    it('throws AUTH_FAILED on invalid credentials', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, () => {
          return HttpResponse.json({ user_info: { auth: 0 } });
        }),
      );

      await expect(xtreamAuth({ server: baseUrl, username: 'bad', password: 'bad' })).rejects.toThrow(/AUTH_FAILED/i);
    });

    it('throws CONNECTION_ERROR on timeout', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 20000));
          return HttpResponse.json({});
        }),
      );

      await expect(
        xtreamAuth({ server: baseUrl, username, password }, 100),
      ).rejects.toThrow(/CONNECTION_ERROR|timeout/i);
    });
  });

  describe('live streams', () => {
    it('fetches live streams and converts to M3UEntry format', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_live_categories') {
            return HttpResponse.json([
              { category_id: '1', category_name: 'News' },
            ]);
          }
          if (action === 'get_live_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'CNN',
                stream_type: 'live',
                stream_id: 100,
                stream_icon: 'https://example.com/cnn.png',
                category_id: '1',
                epg_channel_id: 'cnn.us',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamLive({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('CNN');
      expect(streams[0].url).toContain('/live/');
      expect(streams[0].groupTitle).toBe('News');
      expect(streams[0].mediaFormat).toBe('hls');
    });

    it('filters out streams with empty names', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_live_categories') return HttpResponse.json([]);
          if (action === 'get_live_streams') {
            return HttpResponse.json([
              { num: 1, name: 'CNN', stream_id: 100, category_id: '1' },
              { num: 2, name: '', stream_id: 200, category_id: '1' },
              { num: 3, name: '   ', stream_id: 300, category_id: '1' },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamLive({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('CNN');
    });
  });

  describe('VOD streams', () => {
    it('fetches VOD streams and converts to M3UEntry format', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_vod_categories') {
            return HttpResponse.json([
              { category_id: '10', category_name: 'Action' },
            ]);
          }
          if (action === 'get_vod_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Avatar',
                stream_type: 'movie',
                stream_id: 200,
                stream_icon: 'https://example.com/avatar.jpg',
                category_id: '10',
                container_extension: 'mp4',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamVod({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('Avatar');
      expect(streams[0].url).toContain('/movie/');
      expect(streams[0].url).toMatch(/\.mp4$/);
      expect(streams[0].mediaFormat).toBe('mp4');
    });

    it('builds a movie URL that ends with .mkv when container_extension is mkv', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_vod_categories') return HttpResponse.json([]);
          if (action === 'get_vod_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Hevc Movie',
                stream_id: 201,
                category_id: '10',
                container_extension: 'mkv',
                direct_source: '',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamVod({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].url).toBe(`${baseUrl}/movie/${username}/${password}/201.mkv`);
      expect(streams[0].containerExtension).toBe('mkv');
      expect(streams[0].mediaFormat).toBe('unknown');
    });

    it('uses usable direct_source instead of the constructed movie URL', async () => {
      const direct = 'https://cdn.example.com/real/movie.mkv';
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_vod_categories') return HttpResponse.json([]);
          if (action === 'get_vod_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Direct Movie',
                stream_id: 202,
                category_id: '10',
                container_extension: 'mp4',
                direct_source: direct,
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamVod({ server: baseUrl, username, password });
      expect(streams[0].url).toBe(direct);
      expect(streams[0].directSource).toBe(direct);
    });

    it('does not invent .mp4 when container_extension is missing', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_vod_categories') return HttpResponse.json([]);
          if (action === 'get_vod_streams') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Bare Movie',
                stream_id: 203,
                category_id: '10',
                container_extension: '',
                direct_source: '',
              },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamVod({ server: baseUrl, username, password });
      expect(streams[0].url).toBe(`${baseUrl}/movie/${username}/${password}/203`);
      expect(streams[0].url).not.toMatch(/\.mp4$/);
      expect(streams[0].mediaFormat).toBe('unknown');
    });

    it('filters out VOD streams with empty names', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_vod_categories') return HttpResponse.json([]);
          if (action === 'get_vod_streams') {
            return HttpResponse.json([
              { num: 1, name: 'Avatar', stream_id: 200, category_id: '10', container_extension: 'mp4' },
              { num: 2, name: null, stream_id: 300, category_id: '10', container_extension: 'mp4' },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamVod({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('Avatar');
    });
  });

  describe('series', () => {
    it('fetches one catalog row per series without calling get_series_info', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_series_categories') {
            return HttpResponse.json([
              { category_id: '20', category_name: 'Drama' },
            ]);
          }
          if (action === 'get_series') {
            return HttpResponse.json([
              {
                num: 1,
                name: 'Breaking Bad',
                series_id: 300,
                category_id: '20',
                cover: 'https://example.com/bb.jpg',
                genre: 'Drama',
              },
            ]);
          }
          if (action === 'get_series_info') {
            throw new Error('get_series_info must not be called during catalog ingest');
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamSeries({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('Breaking Bad');
      expect(streams[0].url).toContain('/series/');
      expect(streams[0].url).toContain('/300.m3u8');
      expect(streams[0].groupTitle).toBe('Drama');
    });

    it('filters out series with empty names', async () => {
      server.use(
        http.get(`${baseUrl}/player_api.php`, ({ request }) => {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');
          if (action === 'get_series_categories') return HttpResponse.json([]);
          if (action === 'get_series') {
            return HttpResponse.json([
              { num: 1, name: 'Breaking Bad', series_id: 300, category_id: '20', cover: '' },
              { num: 2, name: '', series_id: 301, category_id: '20', cover: '' },
            ]);
          }
          return HttpResponse.json({});
        }),
      );

      const streams = await fetchXtreamSeries({ server: baseUrl, username, password });
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('Breaking Bad');
      expect(streams[0].url).toContain('/300.m3u8');
    });
  });

  describe('buildHonestStreamUrl', () => {
    const creds = { server: baseUrl, username, password, streamId: 99 };

    it('appends the real mkv extension for movies', () => {
      expect(
        buildHonestStreamUrl({
          ...creds,
          type: 'movie',
          containerExtension: 'mkv',
          directSource: '',
        }),
      ).toBe(`${baseUrl}/movie/${username}/${password}/99.mkv`);
    });

    it('returns usable https direct_source as the play URL', () => {
      const direct = 'https://origin.example/play/file.mkv';
      expect(
        buildHonestStreamUrl({
          ...creds,
          type: 'movie',
          containerExtension: 'mp4',
          directSource: direct,
        }),
      ).toBe(direct);
    });

    it('does not invent .mp4 when extension and direct_source are missing', () => {
      const url = buildHonestStreamUrl({
        ...creds,
        type: 'movie',
        containerExtension: '',
        directSource: '',
      });
      expect(url).toBe(`${baseUrl}/movie/${username}/${password}/99`);
      expect(url.endsWith('.mp4')).toBe(false);
    });

    it('keeps live .m3u8 unless direct_source is usable', () => {
      expect(
        buildHonestStreamUrl({
          ...creds,
          type: 'live',
          containerExtension: '',
          directSource: '',
        }),
      ).toBe(`${baseUrl}/live/${username}/${password}/99.m3u8`);
    });

    it('rejects non-http direct_source and uses the constructed URL', () => {
      expect(
        buildHonestStreamUrl({
          ...creds,
          type: 'movie',
          containerExtension: 'mkv',
          directSource: 'ftp://not-usable/file.mkv',
        }),
      ).toBe(`${baseUrl}/movie/${username}/${password}/99.mkv`);
    });
  });
});
