import { createNativeLibmpvBinding, type LibmpvBinding } from './libmpv-binding.js';
import {
  libmpvSid,
  mapLibmpvTracks,
  type PlayerTrack,
} from '../../shared/player-chrome.js';

export type { LibmpvBinding, PlayerTrack };

export type LibmpvPlaybackProfile = 'live' | 'vod';

export type LibmpvPlayRequest = {
  url: string;
  httpHeaders: Record<string, string>;
  nativeWindowHandle?: Buffer;
  profile?: LibmpvPlaybackProfile;
};

export type LibmpvPlayResult =
  | { ok: true; engine: 'libmpv' }
  | { ok: false; error: { code: 'INTERNAL'; details: { kind: 'libmpv-load-failed' } } };

export type LibmpvEngine = {
  play(request: LibmpvPlayRequest): Promise<LibmpvPlayResult>;
  stop(): Promise<void>;
  setPaused(paused: boolean): void;
  getTracks(): { audio: PlayerTrack[]; subtitles: PlayerTrack[] };
  setAudioTrack(aid: number): void;
  setSubtitleTrack(sid: number): void;
  addSubtitle(path: string): void;
  seek(time: number): void;
  getStatus(): { currentTime: number; duration: number; buffered: number };
};

export function libmpvPlaybackOptions(
  profile: LibmpvPlaybackProfile,
): Record<string, string | number> {
  if (profile === 'live') {
    return {
      cache: 'yes',
      'cache-secs': 20,
      reconnect: 'yes',
      hwdec: 'auto-safe',
    };
  }
  return {};
}

export function createLibmpvEngine(binding: LibmpvBinding = createNativeLibmpvBinding()): LibmpvEngine {
  let loaded = false;

  return {
    async play(request: LibmpvPlayRequest): Promise<LibmpvPlayResult> {
      loaded = binding.loadLibrary();
      if (!loaded) {
        return {
          ok: false,
          error: { code: 'INTERNAL', details: { kind: 'libmpv-load-failed' } },
        };
      }
      binding.setOptions?.(libmpvPlaybackOptions(request.profile ?? 'vod'));
      binding.play(request.url, request.httpHeaders, request.nativeWindowHandle);
      return { ok: true, engine: 'libmpv' };
    },
    async stop(): Promise<void> {
      if (!loaded) return;
      binding.stop();
    },
    setPaused(paused: boolean): void {
      if (!loaded) return;
      binding.setProperty?.('pause', paused ? 'yes' : 'no');
    },
    getTracks() {
      const list = binding.getTrackList?.() ?? [];
      return {
        audio: mapLibmpvTracks(list, 'audio'),
        subtitles: mapLibmpvTracks(list, 'sub'),
      };
    },
    setAudioTrack(aid: number): void {
      binding.setProperty?.('aid', aid);
    },
    setSubtitleTrack(sid: number): void {
      binding.setProperty?.('sid', libmpvSid(sid));
    },
    addSubtitle(path: string): void {
      binding.command?.(['sub-add', path]);
    },
    seek(time: number): void {
      binding.command?.(['seek', time, 'absolute']);
    },
    getStatus() {
      return {
        currentTime: Number(binding.getProperty?.('time-pos') ?? 0),
        duration: Number(binding.getProperty?.('duration') ?? 0),
        buffered: Number(binding.getProperty?.('demuxer-cache-time') ?? 0),
      };
    },
  };
}
