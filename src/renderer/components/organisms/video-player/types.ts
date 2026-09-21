import type { Season } from '../../../features/player/next-episode';
import type { Episode } from '../../../../shared/types/ipc';

export type PlaybackSource = {
  url: string;
  mediaFormat: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
  httpHeaders?: Record<string, string>;
  type: 'live' | 'movie' | 'episode';
  engine?: 'libmpv';
};

export type EngineState = 'idle' | 'loading' | 'playing' | 'recovering' | 'error';

export type AspectRatio = '16:9' | '4:3' | 'zoom' | 'fit';

export interface VideoPlayerProps {
  /** Playback source (URL, format, headers) */
  source: PlaybackSource;
  /** In-process libmpv load failure. No Chromium fallback. */
  diagnosis?: { kind: string } | null;
  /** Called when playback ends naturally */
  onEnded?: () => void;
  /** Called when a fatal playback error occurs */
  onError?: (error: Error) => void;
  /** Called periodically with current playback position and duration */
  onTimeUpdate?: (position: number, duration: number) => void;
  /** Navigate to the next episode */
  onNextEpisode?: (episode: Episode) => void;
  /** Series seasons for next-episode resolution (episode type only) */
  seasons?: Season[];
  /** Current episode for next-episode card (episode type only) */
  currentEpisode?: Episode | null;
  /** Whether to show next-episode card */
  showNextEpisodeCard?: boolean;
  /** Custom className */
  className?: string;
}
