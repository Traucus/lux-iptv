export type PlayerTrack = { id: number; name: string; lang?: string };

export type LibmpvTrackListEntry = {
  id: number;
  type: string;
  title?: string;
  lang?: string;
};

export const SUBTITLE_OFF_SID = -1;

export function mapLibmpvTracks(
  list: LibmpvTrackListEntry[],
  type: 'audio' | 'sub',
): PlayerTrack[] {
  return list
    .filter((track) => track.type === type)
    .map((track) => ({
      id: track.id,
      name: track.title || track.lang || `${type} ${track.id}`,
      ...(track.lang ? { lang: track.lang } : {}),
    }));
}

export function isExternalSubtitleFile(path: string): boolean {
  return /\.(srt|ass)$/i.test(path);
}

export function libmpvSid(sid: number): number | 'no' {
  return sid < 0 ? 'no' : sid;
}

export function isLiveRewindEnabled(type: 'live' | 'movie' | 'episode'): boolean {
  return type !== 'live';
}

export function exclusiveFullscreenPayload(fullscreen: boolean): { fullscreen: boolean } {
  return { fullscreen };
}

/** HWND hole so Chromium OSD is not covered. Keep native/lux-libmpv addon.cc in sync. */
export const OSD_HWND_INSET = { top: 88, bottom: 168 } as const;

export const OSD_CONTROL_TITLES = {
  rewind: 'Rewind 10 seconds',
  playPause: 'Play/Pause',
  forward: 'Forward 10 seconds',
  audio: 'Audio tracks',
  subtitle: 'Subtitles',
  loadSubtitle: 'Load subtitle file',
  fullscreen: 'Fullscreen',
} as const;
