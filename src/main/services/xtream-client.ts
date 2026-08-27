export interface XtreamClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs?: number;
}

export interface XtreamAuthResult {
  auth: number;
  status?: string;
}

export interface XtreamCategory {
  categoryId: string;
  categoryName: string;
}

/**
 * HTTP request hints for a single stream, in the canonical wire format
 * (header name → value). Same shape as the `http_headers` Drizzle column,
 * so the ingest worker can persist directly without re-keying.
 */
export type XtreamStreamHeaders = Record<string, string>;

export interface XtreamLiveStream {
  num: number;
  name: string;
  streamType: string;
  streamId: number;
  streamIcon?: string;
  categoryId: string;
  /**
   * Per-stream HTTP request hints returned by the Xtream API. `{}` when the
   * provider did not configure custom headers for this stream.
   */
  httpHeaders: XtreamStreamHeaders;
}

export interface XtreamVodStream {
  num: number;
  name: string;
  streamType: string;
  streamId: number;
  categoryId: string;
  rating?: string;
  cover?: string;
  httpHeaders: XtreamStreamHeaders;
}

export interface XtreamSeriesStream {
  num: number;
  name: string;
  seriesId: number;
  categoryId: string;
  cover?: string;
}

const DEFAULT_TIMEOUT_MS = 15000;

export class XtreamClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly timeoutMs: number;

  constructor(config: XtreamClientConfig) {
    // Enforce HTTPS
    if (!config.baseUrl.startsWith('https://')) {
      throw new Error('HTTPS_ONLY: Xtream Codes API requires HTTPS');
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.username = config.username;
    this.password = config.password;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}/player_api.php`);
    url.searchParams.set('username', this.username);
    url.searchParams.set('password', this.password);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      if (response.status === 401) {
        throw new Error('AUTH_FAILED: Invalid credentials');
      }
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}: Request failed`);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`CONNECTION_ERROR: Request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async login(): Promise<XtreamAuthResult> {
    const data = await request<{ user_info?: { auth: number; status?: string } }>(
      this.baseUrl,
      this.username,
      this.password,
      {},
      this.timeoutMs,
    );
    if (!data.user_info || data.user_info.auth !== 1) {
      throw new Error('AUTH_FAILED: Invalid credentials');
    }
    return { auth: data.user_info.auth, status: data.user_info.status };
  }

  async getLiveCategories(): Promise<XtreamCategory[]> {
    return this.getCategories('get_live_categories');
  }

  async getVODCategories(): Promise<XtreamCategory[]> {
    return this.getCategories('get_vod_categories');
  }

  async getSeriesCategories(): Promise<XtreamCategory[]> {
    return this.getCategories('get_series_categories');
  }

  private async getCategories(action: string): Promise<XtreamCategory[]> {
    const data = await this.request<Array<{ category_id: string; category_name: string }>>({ action });
    return data.map((c) => ({
      categoryId: c.category_id,
      categoryName: c.category_name,
    }));
  }

  async getLiveStreams(categoryId: string): Promise<XtreamLiveStream[]> {
    const data = await this.request<Array<{
      num: number;
      name: string;
      stream_type: string;
      stream_id: number;
      stream_icon?: string;
      category_id: string;
      user_agent?: string;
      referer?: string;
    }>>({ action: 'get_live_streams', category_id: categoryId });
    return data.map((s) => ({
      num: s.num,
      name: s.name,
      streamType: s.stream_type,
      streamId: s.stream_id,
      streamIcon: s.stream_icon,
      categoryId: s.category_id,
      httpHeaders: buildXtreamHeaders(s.user_agent, s.referer),
    }));
  }

  async getVODStreams(categoryId: string): Promise<XtreamVodStream[]> {
    const data = await this.request<Array<{
      num: number;
      name: string;
      stream_type: string;
      stream_id: number;
      category_id: string;
      rating?: string;
      cover?: string;
      user_agent?: string;
      referer?: string;
    }>>({ action: 'get_vod_streams', category_id: categoryId });
    return data.map((s) => ({
      num: s.num,
      name: s.name,
      streamType: s.stream_type,
      streamId: s.stream_id,
      categoryId: s.category_id,
      rating: s.rating,
      cover: s.cover,
      httpHeaders: buildXtreamHeaders(s.user_agent, s.referer),
    }));
  }

  async getSeriesStreams(categoryId: string): Promise<XtreamSeriesStream[]> {
    const data = await this.request<Array<{
      num: number;
      name: string;
      series_id: number;
      category_id: string;
      cover?: string;
    }>>({ action: 'get_series', category_id: categoryId });
    return data.map((s) => ({
      num: s.num,
      name: s.name,
      seriesId: s.series_id,
      categoryId: s.category_id,
      cover: s.cover,
    }));
  }
}

/**
 * Builds the canonical `http_headers` object for a stream from Xtream
 * `user_agent` / `referer` fields. Returns `{}` when both are missing —
 * downstream code (Drizzle, ingestion) treats `{}` as "no overrides".
 */
function buildXtreamHeaders(userAgent?: string, referer?: string): XtreamStreamHeaders {
  const out: XtreamStreamHeaders = {};
  if (userAgent) out['User-Agent'] = userAgent;
  if (referer) out['Referer'] = referer;
  return out;
}

// Helper for login (standalone function to avoid circular this)
async function request<T>(
  baseUrl: string,
  username: string,
  password: string,
  params: Record<string, string>,
  timeoutMs: number,
): Promise<T> {
  const url = new URL(`${baseUrl}/player_api.php`);
  url.searchParams.set('username', username);
  url.searchParams.set('password', password);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 401) {
      throw new Error('AUTH_FAILED: Invalid credentials');
    }
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: Request failed`);
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`CONNECTION_ERROR: Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
