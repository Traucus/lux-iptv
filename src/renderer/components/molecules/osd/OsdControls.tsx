import React, { useState, useRef, useEffect } from 'react';
import { TrackSelectorModal } from './TrackSelectorModal';
import { AspectRatioSelector } from './AspectRatioSelector';

/**
 * OsdControls — Bottom controls bar with playback controls and track selectors.
 *
 * Design §7.5: OsdControls — rewind-10, play/pause, fwd-10, audio, subtitle, aspect buttons
 * No parental lock button (deferred to Slice 4)
 */

export interface OsdControlsProps {
  /** Current playback state */
  isPlaying: boolean;
  /** Current audio track index */
  audioTrackIndex: number;
  /** Available audio tracks */
  audioTracks: Array<{ id: number; name: string; lang?: string }>;
  /** Current subtitle track index (-1 for off) */
  subtitleTrackIndex: number;
  /** Available subtitle tracks */
  subtitleTracks: Array<{ id: number; name: string; lang?: string }>;
  /** Current aspect ratio */
  aspectRatio: '16:9' | '4:3' | 'zoom' | 'fit';
  /** Whether OSD is visible */
  visible: boolean;
  /** Event handlers */
  onRewind10: () => void;
  onPlayPause: () => void;
  onForward10: () => void;
  onAudioTrackChange: (index: number) => void;
  onSubtitleTrackChange: (index: number) => void;
  onAspectRatioChange: (ratio: '16:9' | '4:3' | 'zoom' | 'fit') => void;
  /** Custom className */
  className?: string;
}

export const OsdControls: React.FC<OsdControlsProps> = ({
  isPlaying,
  audioTrackIndex,
  audioTracks,
  subtitleTrackIndex,
  subtitleTracks,
  aspectRatio,
  visible,
  onRewind10,
  onPlayPause,
  onForward10,
  onAudioTrackChange,
  onSubtitleTrackChange,
  onAspectRatioChange,
  className = '',
}) => {
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const audioButtonRef = useRef<HTMLButtonElement>(null);
  const subtitleButtonRef = useRef<HTMLButtonElement>(null);

  // Close modals when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showAudioModal && audioButtonRef.current && !audioButtonRef.current.contains(e.target as Node)) {
        setShowAudioModal(false);
      }
      if (showSubtitleModal && subtitleButtonRef.current && !subtitleButtonRef.current.contains(e.target as Node)) {
        setShowSubtitleModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAudioModal, showSubtitleModal]);

  // Close modals on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAudioModal(false);
        setShowSubtitleModal(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const buttonStyle = {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    transition: 'background 0.2s, transform 0.1s',
  } as React.CSSProperties;

  const activeButtonStyle = {
    ...buttonStyle,
    background: 'rgba(255,255,255,0.4)',
  };

  return (
    <div
      className={`osd-controls ${visible ? 'visible' : 'hidden'} ${className}`.trim()}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 10,
      }}
      data-testid="osd-controls"
    >
      {/* Rewind 10s */}
      <button
        onClick={onRewind10}
        style={buttonStyle}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.4)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        data-testid="osd-rewind10"
        aria-label="Rewind 10 seconds"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="19 20 9 12 19 4 19 20" />
          <line x1="5" y1="19" x2="5" y2="5" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        style={{
          ...buttonStyle,
          width: '64px',
          height: '64px',
          background: 'rgba(255,255,255,0.3)',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.5)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        data-testid="osd-play-pause"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Forward 10s */}
      <button
        onClick={onForward10}
        style={buttonStyle}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.4)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        data-testid="osd-forward10"
        aria-label="Forward 10 seconds"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </button>

      {/* Audio Track Selector */}
      <div style={{ position: 'relative' }}>
        <button
          ref={audioButtonRef}
          onClick={() => setShowAudioModal(!showAudioModal)}
          style={audioTracks.length > 1 ? activeButtonStyle : buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.4)')}
          onMouseOut={(e) => (e.currentTarget.style.background = audioTracks.length > 1 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)')}
          data-testid="osd-audio-button"
          aria-label="Audio tracks"
          aria-expanded={showAudioModal}
          disabled={audioTracks.length <= 1}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9 2 9 2 15 6 15 11 19 11 5z" />
            <path d="M19 9l6 6-6 6-4-4 6-6-6-6z" />
          </svg>
        </button>
        
        {showAudioModal && audioTracks.length > 1 && (
          <TrackSelectorModal
            tracks={audioTracks}
            selectedIndex={audioTrackIndex}
            onSelect={onAudioTrackChange}
            onClose={() => setShowAudioModal(false)}
            title="Audio Track"
          />
        )}
        </div>

      {/* Subtitle Track Selector */}
      <div style={{ position: 'relative' }}>
        <button
          ref={subtitleButtonRef}
          onClick={() => setShowSubtitleModal(!showSubtitleModal)}
          style={subtitleTracks.length > 0 ? activeButtonStyle : buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.4)')}
          onMouseOut={(e) => (e.currentTarget.style.background = subtitleTracks.length > 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)')}
          data-testid="osd-subtitle-button"
          aria-label="Subtitle tracks"
          aria-expanded={showSubtitleModal}
          disabled={subtitleTracks.length === 0}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19h16M4 15h16M10 5v14" />
          </svg>
        </button>
        
        {showSubtitleModal && subtitleTracks.length > 0 && (
          <TrackSelectorModal
            tracks={subtitleTracks}
            selectedIndex={subtitleTrackIndex}
            onSelect={onSubtitleTrackChange}
            onClose={() => setShowSubtitleModal(false)}
            title="Subtitles"
            showOffOption={true}
          />
        )}
        </div>

      {/* Aspect Ratio Selector */}
      <AspectRatioSelector
        current={aspectRatio}
        onChange={onAspectRatioChange}
        disabled={!visible}
      />
    </div>
  );
};

export default OsdControls;