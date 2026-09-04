import React, { useEffect, useState, useCallback } from 'react';
import { SeekBar } from '../molecules/osd/SeekBar';
import { OsdTopBar } from '../molecules/osd/OsdTopBar';
import { OsdControls } from '../molecules/osd/OsdControls';
import { NextEpisodeCard } from '../molecules/osd/NextEpisodeCard';
import { useIdleOSD } from '../../hooks/useIdleOSD';
import { Spinner } from '../atoms/Spinner';
import type { Season } from '../../features/player/next-episode';
import type { Episode } from '../../../shared/types/ipc';
import { createLuxAPI } from '../../lib/api';
import {
  exclusiveFullscreenPayload,
  isExternalSubtitleFile,
  isLiveRewindEnabled,
  type PlayerTrack,
} from '../../features/player/player-chrome';

/**
 * VideoPlayer — Fullscreen video player organism with OSD overlay.
 *
 * Hosts the in-process libmpv surface. Chromium hls.js / mpegts / native
 * `<video>` engines are not the product playback path.
 */

type PlaybackSource = {
  url: string;
  mediaFormat: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
  httpHeaders?: Record<string, string>;
  type: 'live' | 'movie' | 'episode';
  engine?: 'libmpv';
};

export interface VideoPlayerProps {
  /** Playback source (URL, format, headers) */
  source: PlaybackSource;
  /** In-process libmpv load failure. No Chromium fallback. */
  diagnosis?: { kind: string } | null;
  /** Called when playback ends naturally */
  onEnded?: () => void;
  /** Called when a fatal playback error occurs */
  onError?: (error: Error) => void;
  /** Called periodically with current playback position */
  onTimeUpdate?: (position: number) => void;
  /** Series seasons for next-episode resolution (episode type only) */
  seasons?: Season[];
  /** Current episode for next-episode card (episode type only) */
  currentEpisode?: Episode | null;
  /** Whether to show next-episode card */
  showNextEpisodeCard?: boolean;
  /** Custom className */
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  source,
  diagnosis = null,
  onEnded,
  onError,
  onTimeUpdate,
  seasons,
  currentEpisode,
  showNextEpisodeCard = false,
  className = '',
}) => {
  const [engineState, setEngineState] = useState<'idle' | 'loading' | 'playing' | 'recovering' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState<Array<{ start: number; end: number }>>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTrackIndex, setAudioTrackIndex] = useState(0);
  const [subtitleTrackIndex, setSubtitleTrackIndex] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<PlayerTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<PlayerTrack[]>([]);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | 'zoom' | 'fit'>('16:9');
  const [nextEpisode] = useState<Episode | null>(null);
  const [showNextEpisodeCardState, setShowNextEpisodeCardState] = useState(false);

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
        setCurrentTime(status.data.currentTime);
        setDuration(status.data.duration);
        setBuffered([{ start: 0, end: status.data.buffered }]);
      }
    } catch {
      // Renderer tests and unload without luxAPI must still mount.
    }
  }, []);

  useEffect(() => {
    setEngineState(diagnosis ? 'error' : 'playing');
    if (diagnosis) {
      setErrorMessage('libmpv failed to load');
    }
    void refreshTracks();
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
      window.removeEventListener('keydown', onEscape);
      try {
        void createLuxAPI().player.stop();
      } catch {
        // Renderer tests and unload without luxAPI must still unmount.
      }
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
    setIsPlaying((playing) => !playing);
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

  const videoStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: aspectRatio === 'zoom' ? 'cover' : 'contain',
    background: '#000',
  };

  if (aspectRatio === '4:3') {
    videoStyle.aspectRatio = '4/3';
  }

  return (
    <div
      className={`video-player ${className}`.trim()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
        overflow: 'hidden',
      }}
      data-testid="video-player"
      onMouseMove={() => {}} // Keep OSD visible on mouse move (handled by useIdleOSD)
    >
      <div
        style={videoStyle}
        data-testid="libmpv-surface"
        aria-label="libmpv surface"
      />
      <input
        type="file"
        accept=".srt,.ass"
        data-testid="osd-add-subtitle"
        title="Add subtitle"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const path =
            'path' in file && typeof file.path === 'string' ? file.path : file.name;
          handleAddSubtitle(path);
        }}
      />

      {/* Spinner during recovering */}
      {engineState === 'recovering' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            zIndex: 5,
          }}
          data-testid="recovering-spinner"
        >
          <Spinner size="lg" />
        </div>
      )}

      {diagnosis?.kind === 'libmpv-load-failed' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)',
            color: '#fff',
            padding: '24px',
            textAlign: 'center',
            zIndex: 12,
          }}
          data-testid="libmpv-diagnosis"
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>libmpv failed to load</h3>
          <p style={{ margin: 0, color: '#888' }}>
            In-process libmpv is unavailable. Chromium playback is not a fallback.
          </p>
        </div>
      )}

      {/* Error UI */}
      {engineState === 'error' && !diagnosis && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)',
            color: '#fff',
            padding: '24px',
            textAlign: 'center',
            zIndex: 10,
          }}
          data-testid="error-ui"
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Playback Error</h3>
          <p style={{ margin: 0, color: '#888' }}>{errorMessage}</p>
        </div>
      )}

      {/* OSD Overlay */}
      {osdVisible && (
        <>
          {/* Top Bar */}
          <OsdTopBar
            title={source.type === 'live' ? 'Live TV' : 'Content Title'}
            resolution={undefined}
            audioTrack={audioTracks[audioTrackIndex]?.name}
            onBack={() => {
              // Navigation handled by parent
              window.history.back();
            }}
            visible={true}
          />

          {/* Controls */}
          <OsdControls
            isPlaying={isPlaying}
            audioTrackIndex={audioTrackIndex}
            audioTracks={audioTracks}
            subtitleTrackIndex={subtitleTrackIndex}
            subtitleTracks={subtitleTracks}
            aspectRatio={aspectRatio}
            visible={true}
            onRewind10={handleRewind10}
            onPlayPause={handlePlayPause}
            onForward10={handleForward10}
            onAudioTrackChange={handleAudioTrackChange}
            onSubtitleTrackChange={handleSubtitleTrackChange}
            onAspectRatioChange={setAspectRatio}
            onFullscreen={handleFullscreen}
            rewindDisabled={!isLiveRewindEnabled(source.type)}
          />

          {/* SeekBar (hidden for live) */}
          {source.type !== 'live' && (
            <SeekBar
              currentTime={currentTime}
              duration={duration}
              buffered={buffered}
              onSeek={handleSeek}
              disabled={duration <= 0}
            />
          )}
        </>
      )}

      {/* Next Episode Card */}
      {showNextEpisodeCardState && nextEpisode && (
        <NextEpisodeCard
          episode={nextEpisode}
          onWatchNow={() => {
            // Parent handles navigation
            setShowNextEpisodeCardState(false);
          }}
          onDismiss={() => setShowNextEpisodeCardState(false)}
          visible={true}
        />
      )}

      {/* LIVE badge */}
      {source.type === 'live' && osdVisible && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '24px',
            background: '#ff0000',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            animation: 'pulse 1.5s infinite',
            zIndex: 10,
          }}
          data-testid="live-badge"
        >
          LIVE
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;