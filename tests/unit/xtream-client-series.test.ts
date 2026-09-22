import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchXtreamSeries, buildHonestStreamUrl } from '../../src/main/services/xtream-client';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const baseUrl = 'https://xtream.example.com';
const username = 'testuser';
const password = 'testpass';

describe('xtream-client series', () => {
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
