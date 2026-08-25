/**
 * Feature tests — pure validator logic and feature-level behaviors that can be tested
 * without a full DOM environment. Heavy interactive tests live in tests/e2e.
 */
import { describe, it, expect } from 'vitest';
import { validateCredentials } from '../../../src/renderer/features/ingest/CredentialsForm.tsx';
import type { CredentialsFormValue } from '../../../src/renderer/features/ingest/CredentialsForm.tsx';

const base: CredentialsFormValue = { source: 'm3u', listName: 'Test' };

describe('validateCredentials', () => {
  it('passes when M3U inputs are valid', () => {
    const errors = validateCredentials({ ...base, source: 'm3u', url: 'https://example.com/p.m3u' });
    expect(errors).toEqual({});
  });

  it('rejects M3U URL without protocol', () => {
    const errors = validateCredentials({ ...base, source: 'm3u', url: 'example.com/p.m3u' });
    expect(errors.url).toContain('http');
  });

  it('passes for Xtream with all fields and http URL', () => {
    const errors = validateCredentials({
      source: 'xtream',
      listName: 'X',
      server: 'http://example.com:8080',
      username: 'u',
      password: 'p',
    });
    expect(errors).toEqual({});
  });

  it('rejects Xtream missing server protocol', () => {
    const errors = validateCredentials({
      source: 'xtream',
      listName: 'X',
      server: 'example.com:8080',
      username: 'u',
      password: 'p',
    });
    expect(errors.server).toContain('http');
  });

  it('rejects empty listName', () => {
    const errors = validateCredentials({ ...base, source: 'm3u', url: 'https://x.com/p.m3u', listName: '' });
    expect(errors.listName).toBeDefined();
  });

  it('rejects Xtream missing username', () => {
    const errors = validateCredentials({
      source: 'xtream',
      listName: 'X',
      server: 'http://example.com',
      username: '',
      password: 'p',
    });
    expect(errors.username).toBeDefined();
  });

  it('rejects Xtream missing password', () => {
    const errors = validateCredentials({
      source: 'xtream',
      listName: 'X',
      server: 'http://example.com',
      username: 'u',
      password: '',
    });
    expect(errors.password).toBeDefined();
  });

  it('allows https URLs', () => {
    const errors = validateCredentials({ ...base, source: 'm3u', url: 'https://example.com/p.m3u' });
    expect(errors).toEqual({});
  });
});
