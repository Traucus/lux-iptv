import { buildUrl, fetchJson } from './http.js';
import { DEFAULT_TIMEOUT_MS, type XtreamCredentials } from './types.js';

/**
 * Authenticates with the Xtream API and returns the server info.
 */
export async function xtreamAuth(
  credentials: XtreamCredentials,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ userInfo: unknown; serverInfo: unknown }> {
  const url = buildUrl(credentials.server, {
    username: credentials.username,
    password: credentials.password,
  });
  const data = await fetchJson<Record<string, unknown>>(url, timeoutMs);
  if (!data.user_info || !data.server_info) {
    throw new Error('AUTH_FAILED: Invalid Xtream credentials');
  }
  return { userInfo: data.user_info, serverInfo: data.server_info };
}
