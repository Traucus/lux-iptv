/**
 * In-process libmpv binding. N-API addon first, then optional same-process
 * load of libmpv from LUX_LIBMPV_DIR. Never spawns mpv.exe.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface LibmpvBinding {
  loadLibrary(): boolean;
  play(url: string, headers: Record<string, string>, wid?: Buffer): void;
  stop(): void;
  setOptions?(options: Record<string, string | number>): void;
  getTrackList?(): Array<{ id: number; type: string; title?: string; lang?: string }>;
  setProperty?(name: string, value: string | number): void;
  getProperty?(name: string): string | number | undefined;
  command?(args: Array<string | number>): void;
}

type NativeSession = {
  play: LibmpvBinding['play'];
  stop: LibmpvBinding['stop'];
  setOptions?: NonNullable<LibmpvBinding['setOptions']>;
};

type NativeAddon = {
  create?: () => NativeSession;
  play?: LibmpvBinding['play'];
  stop?: LibmpvBinding['stop'];
  setOptions?: NonNullable<LibmpvBinding['setOptions']>;
};

function tryLoadNapiAddon(): NativeAddon | null {
  const candidates = [
    process.env.LUX_LIBMPV_DIR ? `${process.env.LUX_LIBMPV_DIR}/lux-libmpv.node` : '',
    'lux-libmpv.node',
  ].filter(Boolean);

  for (const id of candidates) {
    try {
      // In-process only. Dynamic require keeps Electron ABI mismatch from
      // crashing module evaluation when the addon is absent.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const loaded = require(id) as NativeAddon;
      if (loaded && (typeof loaded.create === 'function' || typeof loaded.play === 'function')) {
        return loaded;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

export function createNativeLibmpvBinding(): LibmpvBinding {
  let session: NativeSession | null = null;

  return {
    loadLibrary(): boolean {
      const addon = tryLoadNapiAddon();
      if (!addon) {
        session = null;
        return false;
      }
      if (typeof addon.create === 'function') {
        session = addon.create();
        return true;
      }
      if (typeof addon.play === 'function' && typeof addon.stop === 'function') {
        session = { play: addon.play, stop: addon.stop, setOptions: addon.setOptions };
        return true;
      }
      session = null;
      return false;
    },
    play(url: string, headers: Record<string, string>, wid?: Buffer): void {
      if (!session) {
        throw new Error('libmpv is not loaded');
      }
      session.play(url, headers, wid);
    },
    stop(): void {
      session?.stop();
    },
    setOptions(options: Record<string, string | number>): void {
      session?.setOptions?.(options);
    },
  };
}
