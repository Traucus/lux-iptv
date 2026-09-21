import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdleOSD } from '../../../hooks/useIdleOSD';
import { createLuxAPI } from '../../../lib/api';
import {
  exclusiveFullscreenPayload,
  isExternalSubtitleFile,
  isLiveRewindEnabled,
  type PlayerTrack,
} from '../../../features/player/player-chrome';
import type { Episode } from '../../../../shared/types/ipc';
import type { AspectRatio, EngineState, VideoPlayerProps } from './types';

export function useVideoPlayer({
  source,
  diagnosis = null,
  onEnded,
  onError,
  onTimeUpdate,
  seasons,
  currentEpisode,
  showNextEpisodeCard = false,
}: VideoPlayerProps) {
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState<Array<{ start: number; end: number }>>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTrackIndex, setAudioTrackIndex] = useState(0);
  const [subtitleTrackIndex, setSubtitleTrackIndex] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<PlayerTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<PlayerTrack[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [showNextEpisodeCardState, setShowNextEpisodeCardState] = useState(false);
  const subtitleFileInputRef = useRef<HTMLInputElement>(null);

  const { visible: osdVisible } = useIdleOSD(4000);

  const refreshTracks = useCallback(async () => {
    try {
      const api = createLuxAPI().player;
      const result = await api.getTracks();
      if (result && 'data' in result && result.data) {
        setAudioTracks(result.data.audio);
        setSubtitleTracks(result.data.subtitles);
      }
      const status = await api.getStatus?.();
      if (status && 'data' in status && status.data) {
        const pos = status.data.currentTime;
        const dur = status.data.duration;
        setCurrentTime(pos);
        setDuration(dur);
        setBuffered([{ start: 0, end: status.data.buffered }]);
        onTimeUpdate?.(pos, dur);
        if (
          showNextEpisodeCard &&
          source.type === 'episode' &&
          currentEpisode &&
          dur > 0 &&
          pos / dur >= 0.95
        ) {
          const next = await api.getNextEpisode?.({ episodeId: currentEpisode.id });
          if (next && 'data' in next && next.data) {
            setNextEpisode(next.data);
            setShowNextEpisodeCardState(true);
          }
        }
      }
    } catch {
      // Renderer tests and unload without luxAPI must still mount.
    }
  }, [onTimeUpdate, showNextEpisodeCard, source.type, currentEpisode]);

  useEffect(() => {
    setEngineState(diagnosis ? 'error' : 'playing');
    setIsPlaying(!diagnosis);
    if (diagnosis) {
      setErrorMessage('libmpv failed to load');
    }
    void refreshTracks();
    const poll = setInterval(() => {
      void refreshTracks();
    }, 1000);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      try {
        void createLuxAPI().player.setFullScreen(exclusiveFullscreenPayload(false));
      } catch {
        // Escape without luxAPI is a no-op in unit tests without the mock.
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      clearInterval(poll);
      window.removeEventListener('keydown', onEscape);
    };
  }, [source, diagnosis, onEnded, onError, onTimeUpdate, seasons, currentEpisode, showNextEpisodeCard, refreshTracks]);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    try {
      void createLuxAPI().player.seek({ time });
    } catch {
      // Seek is best-effort when luxAPI is incomplete.
    }
  }, []);

  const handleRewind10 = useCallback(() => {
    if (!isLiveRewindEnabled(source.type)) return;
    handleSeek(Math.max(0, currentTime - 10));
  }, [currentTime, handleSeek, source.type]);

  const handleFullscreen = useCallback(() => {
    try {
      void createLuxAPI().player.setFullScreen(exclusiveFullscreenPayload(true));
    } catch {
      // Exclusive fullscreen is main-process only.
    }
  }, []);

  const handleForward10 = useCallback(() => {
    const next = currentTime + 10;
    handleSeek(duration > 0 ? Math.min(duration, next) : next);
  }, [currentTime, duration, handleSeek]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((playing) => {
      const nextPlaying = !playing;
      try {
        void createLuxAPI().player.setPaused({ paused: !nextPlaying });
      } catch {
        // Tests without a full luxAPI still toggle the OSD icon.
      }
      return nextPlaying;
    });
  }, []);

  const handleAudioTrackChange = useCallback((aid: number) => {
    setAudioTrackIndex(aid);
    try {
      void createLuxAPI().player.setAudioTrack({ aid });
    } catch {
      // Tests without a full luxAPI still change the selected track.
    }
  }, []);

  const handleSubtitleTrackChange = useCallback((sid: number) => {
    setSubtitleTrackIndex(sid);
    try {
      void createLuxAPI().player.setSubtitleTrack({ sid });
    } catch {
      // Tests without a full luxAPI still change the selected track.
    }
  }, []);

  const handleLoadSubtitle = useCallback(() => {
    subtitleFileInputRef.current?.click();
  }, []);

  const handleAddSubtitle = useCallback(
    (path: string) => {
      if (!isExternalSubtitleFile(path)) return;
      void (async () => {
        try {
          await createLuxAPI().player.addSubtitle({ path });
          await refreshTracks();
        } catch {
          // External subtitle load is best-effort in unit tests.
        }
      })();
    },
    [refreshTracks],
  );

  return {
    engineState,
    errorMessage,
    currentTime,
    duration,
    buffered,
    isPlaying,
    audioTrackIndex,
    subtitleTrackIndex,
    audioTracks,
    subtitleTracks,
    aspectRatio,
    setAspectRatio,
    nextEpisode,
    showNextEpisodeCardState,
    setShowNextEpisodeCardState,
    osdVisible,
    subtitleFileInputRef,
    handleSeek,
    handleRewind10,
    handleFullscreen,
    handleForward10,
    handlePlayPause,
    handleAudioTrackChange,
    handleSubtitleTrackChange,
    handleLoadSubtitle,
    handleAddSubtitle,
  };
}
