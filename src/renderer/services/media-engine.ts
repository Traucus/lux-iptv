import { FallbackMediaEngine } from './media-engine/fallback-engine';
import type { MediaEngine, PlaybackSource } from './media-engine/types';

export type {
  EngineKind,
  MediaEngine,
  MediaEngineEvent,
  MediaEngineEventData,
  MediaFormat,
  PlaybackSource,
} from './media-engine/types';
export { isHlsNetworkFailure, probeOrder } from './media-engine/types';

export function createMediaEngine(
  videoEl: HTMLVideoElement,
  source: PlaybackSource,
): MediaEngine {
  return new FallbackMediaEngine(videoEl, source);
}
