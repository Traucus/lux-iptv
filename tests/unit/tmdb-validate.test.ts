import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateKey } from '../../src/main/services/tmdb-validate';

describe('tmdb-validate', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('returns { valid: true } on HTTP 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const promise = validateKey('valid-api-key');
    const result = await promise;
    expect(result).toEqual({ valid: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/configuration?api_key=valid-api-key',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns { valid: false } on HTTP 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await validateKey('invalid-api-key');
    expect(result).toEqual({ valid: false });
  });

  it('throws on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(validateKey('any-key')).rejects.toThrow();
  });

  it('aborts after 5s timeout', async () => {
    let capturedSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
      capturedSignal = opts.signal;
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
      });
    });

    const promise = validateKey('any-key');
    vi.advanceTimersByTime(5000);
    await expect(promise).rejects.toThrow();
    expect(capturedSignal?.aborted).toBe(true);
  });
});
