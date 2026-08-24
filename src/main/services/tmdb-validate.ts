const TMDB_CONFIG_URL = 'https://api.themoviedb.org/3/configuration';
const TIMEOUT_MS = 5000;

export async function validateKey(key: string): Promise<{ valid: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${TMDB_CONFIG_URL}?api_key=${key}`, {
      signal: controller.signal,
    });

    if (response.ok) {
      return { valid: true };
    }
    if (response.status === 401) {
      return { valid: false };
    }
    // Other errors: treat as invalid
    return { valid: false };
  } finally {
    clearTimeout(timeout);
  }
}
