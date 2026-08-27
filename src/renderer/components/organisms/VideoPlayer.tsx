import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createMediaEngine, MediaEngine, PlaybackSource } from '../../services/media-engine';
import { SeekBar } from '../molecules/osd/SeekBar';
import { OsdTopBar } from '../molecules/osd/OsdTopBar';
import { OsdControls } from '../molecules/osd/OsdControls';
import { NextEpisodeCard } from '../molecules/osd/NextEpisodeCard';
import { useIdleOSD } from '../../hooks/useIdleOSD';
import { Spinner } from '../atoms/Spinner';
import { resolveNextEpisode, Season } from '../../features/player/next-episode';
import type { Episode } from '../../../shared/types/ipc';

/**
 * VideoPlayer — Fullscreen video player organism with OSD overlay.
 *
 * Design §7.3: Full-bleed `<video>`, MediaEngine ref, OSD overlay, focus management, auto-hide timer
 */

export interface VideoPlayerProps {
  /** Playback source (URL, format, headers) */
  source: PlaybackSource;
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
  onEnded,
  onError,
  onTimeUpdate,
  seasons,
  currentEpisode,
  showNextEpisodeCard = false,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<MediaEngine | null>(null);
  const [engineState, setEngineState] = useState<'idle' | 'loading' | 'playing' | 'recovering' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState<Array<{ start: number; end: number }>>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTrackIndex, setAudioTrackIndex] = useState(0);
  const [subtitleTrackIndex, setSubtitleTrackIndex] = useState(-1);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | 'zoom' | 'fit'>('16:9');
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [showNextEpisodeCardState, setShowNextEpisodeCardState] = useState(false);

  const { visible: osdVisible } = useIdleOSD(4000);

  // Initialize media engine
  useEffect(() => {
    if (!videoRef.current) return;

    const engine = createMediaEngine(videoRef.current, source);
    engineRef.current = engine;

    // Engine event handlers
    const unsubProgress = engine.on('progress', (data) => {
      if (data.loaded) {
        setEngineState('playing');
      }
      if (data.recovered) {
        setEngineState('playing');
      }
    });

    const unsubBuffered = engine.on('buffered', (data) => {
      if (data.buffered && Array.isArray(data.buffered)) {
        setBuffered(data.buffered as Array<{ start: number; end: number }>);
      }
    });

    const unsubRecovering = engine.on('recovering', () => {
      setEngineState('recovering');
    });

    const unsubFatal = engine.on('fatal', (data) => {
      setEngineState('error');
      const msg = `Playback failed after ${data.attempts} retries`;
      setErrorMessage(msg);
      onError?.(new Error(msg));
    });

    const unsubError = engine.on('error', (data) => {
      if (data.fatal === false) {
        console.debug('[VideoPlayer] Non-fatal error:', data);
      }
    });

    // Load the stream
    setEngineState('loading');
    engine.load().catch((err) => {
      setEngineState('error');
      setErrorMessage(err.message);
      onError?.(err);
    });

    return () => {
      unsubProgress();
      unsubBuffered();
      unsubRecovering();
      unsubFatal();
      unsubError();
      engine.destroy();
      engineRef.current = null;
    };
  }, [source, onError]);

  // Video event handlers
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      setBuffered(Array.from({ length: video.buffered.length }, (_, i) => ({
        start: video.buffered.start(i),
        end: video.buffered.end(i),
      })));
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
      
      // Update buffered ranges
      setBuffered(Array.from({ length: video.buffered.length }, (_, i) => ({
        start: video.buffered.start(i),
        end: video.buffered.end(i),
      })));
      
      // Check for next-episode trigger at 95%
      if (
        showNextEpisodeCard &&
        currentEpisode &&
        seasons &&
        !showNextEpisodeCardState &&
        video.duration > 0 &&
        video.currentTime / video.duration >= 0.95
      ) {
        const next = resolveNextEpisode(currentEpisode, seasons);
        if (next) {
          setNextEpisode(next);
          setShowNextEpisodeCardState(true);
        }
      }
    }
  }, [onTimeUpdate, showNextEpisodeCard, currentEpisode, seasons, showNextEpisodeCardState]);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onEnded?.();
  }, [onEnded]);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setEngineState('error');
    const msg = video.error?.message || 'Playback error';
    setErrorMessage(msg);
    onError?.(new Error(msg));
  }, [onError]);

  const handleWaiting = useCallback(() => {
    setEngineState('recovering');
  }, []);

  const handlePlaying = useCallback(() => {
    setEngineState('playing');
  }, []);

  // Seek handler
  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
    }
  }, []);

  // Control handlers
  const handleRewind10 = useCallback(() => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
  }, []);

  const handleForward10 = useCallback(() => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.min(video.duration, video.currentTime + 10);
  }, []);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, []);

  const handleAudioTrackChange = useCallback((index: number) => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (video && engine && engine.kind === 'hls') {
      // For hls.js, we'd set audioTrack
      setAudioTrackIndex(index);
    } else if (video) {
      // For native, we'd set audioTrack if available
      setAudioTrackIndex(index);
    }
  }, []);

  const handleSubtitleTrackChange = useCallback((index: number) => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (video && engine && engine.kind === 'hls') {
      setSubtitleTrackIndex(index);
    } else if (video) {
      setSubtitleTrackIndex(index);
    }
  }, []);

  // Get available tracks from engine
  const audioTracks = engineRef.current?.audioTracks ?? [];
  const subtitleTracks = engineRef.current?.subtitleTracks ?? [];

  // Video aspect ratio style
  const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: aspectRatio === 'zoom' ? 'cover' : aspectRatio === 'fit' ? 'contain' : 'contain',
    transition: 'object-fit 0.2s ease',
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
      <video
        ref={videoRef}
        style={videoStyle}
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        data-testid="video-element"
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

      {/* Error UI */}
      {engineState === 'error' && (
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
            resolution={(() => {
              const engine = engineRef.current;
              if (!engine) return undefined;
              const level = engine.levels?.[engine.currentLevel ?? 0];
              return level ? `${level.height}p` : undefined;
            })()}
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