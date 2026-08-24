import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const VERSION = 'v1';
const STATIC_SALT = 'lux-iptv-tmdb-key-salt-v1';
const KEY_LEN = 32;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const SCRYPT_N = 2 ** 15; // 32768
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(hwid: string): Buffer {
  return scryptSync(hwid, STATIC_SALT, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * SCRYPT_N * SCRYPT_R * 2, // ensure enough memory for scrypt
  });
}

/**
 * Encrypts plaintext using AES-256-GCM with a key derived from HWID via scrypt.
 * Format: v1:<base64([IV 12 bytes][ciphertext][authTag 16 bytes])>
 */
export function encrypt(plaintext: string, hwid: string): string {
  const key = deriveKey(hwid);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LEN });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // [IV][ciphertext][authTag]
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return `${VERSION}:${combined.toString('base64')}`;
}

/**
 * Decrypts a v1:base64 ciphertext using AES-256-GCM.
 * Throws on tampering, wrong HWID, or invalid format.
 */
export function decrypt(ciphertext: string, hwid: string): string {
  const prefix = `${VERSION}:`;
  if (!ciphertext.startsWith(prefix)) {
    throw new Error('Invalid ciphertext: missing or wrong version prefix');
  }

  const combined = Buffer.from(ciphertext.slice(prefix.length), 'base64');

  // Minimum: IV (12) + authTag (16) = 28 bytes (empty ciphertext)
  if (combined.length < IV_LEN + AUTH_TAG_LEN) {
    throw new Error('Invalid ciphertext: too short');
  }

  const iv = combined.subarray(0, IV_LEN);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LEN);
  const encrypted = combined.subarray(IV_LEN, combined.length - AUTH_TAG_LEN);

  const key = deriveKey(hwid);
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LEN });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
