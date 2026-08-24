import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/main/services/encryption';

describe('encryption', () => {
  const hwid = 'test-hwid-1234567890';

  describe('encrypt/decrypt roundtrip', () => {
    it('encrypts plaintext to base64 with v1: prefix', () => {
      const plaintext = 'my-secret-api-key';
      const ciphertext = encrypt(plaintext, hwid);
      expect(ciphertext).toMatch(/^v1:/);
      expect(typeof ciphertext).toBe('string');
    });

    it('decrypts ciphertext back to original plaintext', () => {
      const plaintext = 'my-secret-api-key-12345';
      const ciphertext = encrypt(plaintext, hwid);
      const decrypted = decrypt(ciphertext, hwid);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same-key';
      const c1 = encrypt(plaintext, hwid);
      const c2 = encrypt(plaintext, hwid);
      expect(c1).not.toBe(c2);
    });

    it('handles empty string', () => {
      const plaintext = '';
      const ciphertext = encrypt(plaintext, hwid);
      const decrypted = decrypt(ciphertext, hwid);
      expect(decrypted).toBe(plaintext);
    });

    it('handles long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const ciphertext = encrypt(plaintext, hwid);
      const decrypted = decrypt(ciphertext, hwid);
      expect(decrypted).toBe(plaintext);
    });

    it('handles unicode characters', () => {
      const plaintext = '🔑 secret key with émojis 中文';
      const ciphertext = encrypt(plaintext, hwid);
      const decrypted = decrypt(ciphertext, hwid);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('tamper detection', () => {
    it('throws when ciphertext is tampered (flip 1 byte)', () => {
      const plaintext = 'my-secret-key';
      const ciphertext = encrypt(plaintext, hwid);
      const buffer = Buffer.from(ciphertext.slice(3), 'base64');
      buffer[buffer.length - 1] ^= 0xff;
      const tampered = 'v1:' + buffer.toString('base64');
      expect(() => decrypt(tampered, hwid)).toThrow();
    });

    it('throws when ciphertext is truncated', () => {
      const plaintext = 'my-secret-key';
      const ciphertext = encrypt(plaintext, hwid);
      const buffer = Buffer.from(ciphertext.slice(3), 'base64');
      const truncated = 'v1:' + buffer.slice(0, buffer.length - 5).toString('base64');
      expect(() => decrypt(truncated, hwid)).toThrow();
    });

    it('throws when prefix is missing', () => {
      const plaintext = 'my-secret-key';
      const ciphertext = encrypt(plaintext, hwid);
      const noPrefix = ciphertext.slice(3);
      expect(() => decrypt(noPrefix, hwid)).toThrow();
    });

    it('throws when wrong version prefix', () => {
      const plaintext = 'my-secret-key';
      const ciphertext = encrypt(plaintext, hwid);
      const wrongVersion = 'v2:' + ciphertext.slice(3);
      expect(() => decrypt(wrongVersion, hwid)).toThrow();
    });
  });

  describe('wrong HWID', () => {
    it('throws when decrypting with wrong HWID', () => {
      const plaintext = 'my-secret-key';
      const ciphertext = encrypt(plaintext, hwid);
      const wrongHwid = 'different-hwid-9876543210';
      expect(() => decrypt(ciphertext, wrongHwid)).toThrow();
    });
  });
});
