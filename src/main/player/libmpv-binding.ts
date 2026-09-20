/**
 * In-process libmpv binding. N-API addon first, then optional same-process
 * load of libmpv from LUX_LIBMPV_DIR. Never spawns mpv.exe.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

export type LibmpvPlayOpened = boolean | void | Promise<boolean | void>;

export interface LibmpvBinding {
  loadLibrary(): boolean;
  play(url: string, headers: Record<string, string>, wid?: Buffer): LibmpvPlayOpened;
  stop(): void;
  setOptions?(options: Record<string, string | number>): void;
  getTrackList?(): Array<{ id: number; type: string; title?: string; lang?: string }>;
  setProperty?(name: string, value: string | number): void;
  getProperty?(name: string): string | number | undefined;
  command?(args: Array<string | number>): void;
}

export type NativeSession = {
  play: LibmpvBinding['play'];
  stop: LibmpvBinding['stop'];
  setOptions?: NonNullable<LibmpvBinding['setOptions']>;
  getTrackList?: NonNullable<LibmpvBinding['getTrackList']>;
  setProperty?: NonNullable<LibmpvBinding['setProperty']>;
  getProperty?: NonNullable<LibmpvBinding['getProperty']>;
  command?: NonNullable<LibmpvBinding['command']>;
};

type NativeAddon = NativeSession & {
  create?: () => NativeSession;
};

function tryLoadNapiAddon(): NativeAddon | null {
  const candidates = [
    process.env.LUX_LIBMPV_DIR ? join(process.env.LUX_LIBMPV_DIR, 'lux-libmpv.node') : '',
    join(here, '../../../native/lux-libmpv/build/Release/lux-libmpv.node'),
    join(here, '../../native/lux-libmpv/build/Release/lux-libmpv.node'),
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

function sessionFromAddon(addon: NativeAddon): NativeSession | null {
  if (typeof addon.create === 'function') {
    return addon.create();
  }
  if (typeof addon.play === 'function' && typeof addon.stop === 'function') {
    return {
      play: addon.play,
      stop: addon.stop,
      setOptions: addon.setOptions,
      getTrackList: addon.getTrackList,
      setProperty: addon.setProperty,
      getProperty: addon.getProperty,
      command: addon.command,
    };
  }
  return null;
}

/** Forwards every session method the engine uses. Missing methods stay no-ops. */
export function createForwardingBinding(getSession: () => NativeSession | null): LibmpvBinding {
  return {
    loadLibrary(): boolean {
      return getSession() != null;
    },
    play(url: string, headers: Record<string, string>, wid?: Buffer): LibmpvPlayOpened {
      const session = getSession();
      if (!session) {
        throw new Error('libmpv is not loaded');
      }
      return session.play(url, headers, wid);
    },
    stop(): void {
      getSession()?.stop();
    },
    setOptions(options: Record<string, string | number>): void {
      getSession()?.setOptions?.(options);
    },
    getTrackList() {
      return getSession()?.getTrackList?.() ?? [];
    },
    setProperty(name: string, value: string | number): void {
      getSession()?.setProperty?.(name, value);
    },
    getProperty(name: string): string | number | undefined {
      return getSession()?.getProperty?.(name);
    },
    command(args: Array<string | number>): void {
      getSession()?.command?.(args);
    },
  };
}

export function createNativeLibmpvBinding(): LibmpvBinding {
  let session: NativeSession | null = null;
  const binding = createForwardingBinding(() => session);
  return {
    ...binding,
    loadLibrary(): boolean {
      if (session) return true;
      const addon = tryLoadNapiAddon();
      if (!addon) {
        session = null;
        return false;
      }
      session = sessionFromAddon(addon);
      return session != null;
    },
  };
}
