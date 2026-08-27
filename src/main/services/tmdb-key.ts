import * as fs from 'node:fs';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import { encrypt, decrypt } from './encryption.js';
import { validateKey } from './tmdb-validate.js';

export interface TmdbKeyVault {
  setTmdbKey(plain: string): Promise<{ valid: boolean }>;
  hasTmdbKey(): boolean;
  getTmdbKeyPlain(): Promise<string | null>;
  clearTmdbKey(): Promise<void>;
}

function getHwid(): string {
  return machineIdSync();
}

/**
 * Creates a TMDB key vault backed by a file at the given path.
 * Uses AES-256-GCM encryption with scrypt(HWID) key derivation.
 */
export function createTmdbKeyVault(keyFilePath: string): TmdbKeyVault {
  return {
    async setTmdbKey(plain: string): Promise<{ valid: boolean }> {
      const validation = await validateKey(plain);
      if (!validation.valid) {
        return { valid: false };
      }

      const hwid = getHwid();
      const ciphertext = encrypt(plain, hwid);
      fs.writeFileSync(keyFilePath, ciphertext, 'utf8');
      return { valid: true };
    },

    hasTmdbKey(): boolean {
      return fs.existsSync(keyFilePath);
    },

    async getTmdbKeyPlain(): Promise<string | null> {
      if (!fs.existsSync(keyFilePath)) {
        return null;
      }
      const ciphertext = fs.readFileSync(keyFilePath, 'utf8');
      const hwid = getHwid();
      return decrypt(ciphertext, hwid);
    },

    async clearTmdbKey(): Promise<void> {
      if (fs.existsSync(keyFilePath)) {
        fs.unlinkSync(keyFilePath);
      }
    },
  };
}
