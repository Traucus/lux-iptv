import { createMediaElementMock, createHlsJsMock } from '../../helpers/media-mock';

type MediaFormat = 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';

export interface PlaybackSource {
  url: string;
  mediaFormat: MediaFormat;
  httpHeaders?: Record<string, string>;
  type: 'live' | 'movie' | 'episode';
}

type EngineKind = 'hls' | 'native';

interface MediaEngineEvents {
  on(
    event: 'progress' | 'buffered' | 'error' | 'ended' | 'fatal' | 'recovering',
    handler: (data: unknown) => void,
  ): () => void;
  off(
    event: 'progress' | 'buffered' | 'error' | 'ended' | 'fatal' | 'recovering',
    handler: (data: unknown) => void,
  ): void;
}

interface MediaEngine extends MediaEngineEvents {
  readonly kind: EngineKind;
  load(): Promise<void>;
  destroy(): void;
}

export type TestMediaEngine = MediaEngine & {
  _test: { getHlsMock: () => ReturnType<typeof createHlsJsMock> | null };
};

export function createTestMediaEngine(
  videoEl: ReturnType<typeof createMediaElementMock>,
  source: PlaybackSource,
  hlsMockFactory: () => ReturnType<typeof createHlsJsMock>,
): TestMediaEngine {
  const { mediaFormat } = source;
  const kind: EngineKind = mediaFormat === 'mp4' ? 'native' : 'hls';
  let destroyed = false;
  let hlsMock: ReturnType<typeof createHlsJsMock> | null = null;
  let attempt = 0;
  let nextDelay = 1000;
  const maxRetries = 3;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  function on(event: string, handler: (data: unknown) => void) {
    let set = eventHandlers.get(event);
    if (!set) {
      set = new Set();
      eventHandlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  function off(event: string, handler: (data: unknown) => void) {
    eventHandlers.get(event)?.delete(handler);
  }

  function emit(event: string, data: unknown) {
    const set = eventHandlers.get(event);
    if (!set || set.size === 0) return;
    for (const h of set) h(data);
  }

  function handleNetworkError(_details: unknown) {
    if (attempt >= maxRetries) {
      emit('fatal', { attempts: attempt });
      return;
    }
    const delay = nextDelay;
    attempt++;
    nextDelay *= 2;
    emit('recovering', { attempt, delay, maxRetries });
    retryTimer = setTimeout(() => {
      if (!destroyed && hlsMock) {
        hlsMock.loadSource(source.url);
      }
    }, delay);
  }

  function handleMediaError() {
    if (hlsMock) {
      hlsMock.emit('ERROR', { fatal: false, type: 'mediaErrorRecovered', details: { recovered: true } });
    }
    emit('progress', { recovered: true });
  }

  function handleHlsError(data: Record<string, unknown>) {
    const fatal = data.fatal === true;
    const type = data.type as string;
    if (!fatal) {
      emit('error', data);
      return;
    }
    if (type === 'networkError') {
      handleNetworkError(data.details);
    } else if (type === 'mediaError') {
      handleMediaError();
    } else {
      emit('fatal', { attempts: attempt });
      emit('ERROR', { fatal: true, type, details: data.details });
    }
  }

  async function load(): Promise<void> {
    if (kind === 'hls') {
      hlsMock = hlsMockFactory();
      hlsMock.loadSource(source.url);
      hlsMock.attachMedia(videoEl);
      hlsMock.on('MANIFEST_PARSED', () => {
        attempt = 0;
        nextDelay = 1000;
        emit('progress', { loaded: true });
      });
      hlsMock.on('ERROR', handleHlsError);
      await new Promise<void>((resolve, reject) => {
        const onManifest = () => {
          if (hlsMock) {
            hlsMock.off('MANIFEST_PARSED', onManifest);
            hlsMock.off('fatal', onFatal);
          }
          resolve();
        };
        const onFatal = (data: unknown) => {
          if (hlsMock) {
            hlsMock.off('MANIFEST_PARSED', onManifest);
            hlsMock.off('fatal', onFatal);
          }
          reject(new Error(`HLS fatal: ${(data as Record<string, unknown>).type}`));
        };
        hlsMock!.on('MANIFEST_PARSED', onManifest);
        hlsMock!.on('fatal', onFatal);
      });
      return;
    }
    videoEl.src = source.url;
    videoEl.load();
    videoEl.dispatchEvent({ type: 'loadedmetadata' });
  }

  function destroy(): void {
    destroyed = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (hlsMock) {
      hlsMock.destroy();
      hlsMock = null;
    }
    eventHandlers.clear();
  }

  return {
    get kind() {
      return kind;
    },
    load,
    destroy,
    on,
    off,
    _test: {
      getHlsMock: () => hlsMock,
    },
  };
}
