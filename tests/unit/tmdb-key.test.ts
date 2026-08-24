import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTmdbKeyVault } from '../../src/main/services/tmdb-key';
import * as encryption from '../../src/main/services/encryption';
import * as tmdbValidate from '../../src/main/services/tmdb-validate';

vi.mock('../../src/main/services/encryption');
vi.mock('../../src/main/services/tmdb-validate');

describe('tmdb-key', () => {
  let tmpDir: string;
  let keyFilePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmdb-key-test-'));
    keyFilePath = path.join(tmpDir, 'tmdb-key.enc');
    vi.mocked(tmdbValidate.validateKey).mockReset();
    vi.mocked(encryption.encrypt).mockReset();
    vi.mocked(encryption.decrypt).mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('setTmdbKey', () => {
    it('validates key, encrypts, and writes on valid key', async () => {
      vi.mocked(tmdbValidate.validateKey).mockResolvedValue({ valid: true });
      vi.mocked(encryption.encrypt).mockReturnValue('v1:encrypted-data');

      const vault = createTmdbKeyVault(keyFilePath);
      const result = await vault.setTmdbKey('my-api-key');

      expect(result).toEqual({ valid: true });
      expect(tmdbValidate.validateKey).toHaveBeenCalledWith('my-api-key');
      expect(encryption.encrypt).toHaveBeenCalledWith('my-api-key', expect.any(String));
      expect(fs.readFileSync(keyFilePath, 'utf8')).toBe('v1:encrypted-data');
    });

    it('returns { valid: false } and does NOT write on invalid key', async () => {
      vi.mocked(tmdbValidate.validateKey).mockResolvedValue({ valid: false });

      const vault = createTmdbKeyVault(keyFilePath);
      const result = await vault.setTmdbKey('invalid-key');

      expect(result).toEqual({ valid: false });
      expect(fs.existsSync(keyFilePath)).toBe(false);
    });

    it('throws on network error during validation', async () => {
      vi.mocked(tmdbValidate.validateKey).mockRejectedValue(new Error('Network error'));

      const vault = createTmdbKeyVault(keyFilePath);
      await expect(vault.setTmdbKey('any-key')).rejects.toThrow('Network error');
    });
  });

  describe('hasTmdbKey', () => {
    it('returns false when file does not exist', () => {
      const vault = createTmdbKeyVault(keyFilePath);
      expect(vault.hasTmdbKey()).toBe(false);
    });

    it('returns true when file exists', () => {
      fs.writeFileSync(keyFilePath, 'v1:encrypted');
      const vault = createTmdbKeyVault(keyFilePath);
      expect(vault.hasTmdbKey()).toBe(true);
    });
  });

  describe('getTmdbKeyPlain', () => {
    it('decrypts and returns plaintext key', async () => {
      fs.writeFileSync(keyFilePath, 'v1:encrypted-data');
      vi.mocked(encryption.decrypt).mockReturnValue('my-api-key');

      const vault = createTmdbKeyVault(keyFilePath);
      const result = await vault.getTmdbKeyPlain();

      expect(result).toBe('my-api-key');
      expect(encryption.decrypt).toHaveBeenCalledWith('v1:encrypted-data', expect.any(String));
    });

    it('returns null when file does not exist', async () => {
      const vault = createTmdbKeyVault(keyFilePath);
      const result = await vault.getTmdbKeyPlain();
      expect(result).toBeNull();
    });
  });

  describe('clearTmdbKey', () => {
    it('deletes the key file', async () => {
      fs.writeFileSync(keyFilePath, 'v1:encrypted');
      const vault = createTmdbKeyVault(keyFilePath);

      await vault.clearTmdbKey();
      expect(fs.existsSync(keyFilePath)).toBe(false);
    });

    it('does not throw if file does not exist', async () => {
      const vault = createTmdbKeyVault(keyFilePath);
      await expect(vault.clearTmdbKey()).resolves.toBeUndefined();
    });
  });
});
