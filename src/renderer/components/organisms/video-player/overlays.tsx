import React from 'react';
import { Spinner } from '../../atoms/Spinner';
import { NextEpisodeCard } from '../../molecules/osd/NextEpisodeCard';
import type { Episode } from '../../../../shared/types/ipc';
import type { EngineState } from './types';

export function VideoPlayerOverlays({
  engineState,
  diagnosis,
  errorMessage,
  osdVisible,
  sourceType,
  showNextEpisodeCardState,
  nextEpisode,
  onWatchNow,
  onDismiss,
}: {
  engineState: EngineState;
  diagnosis: { kind: string } | null;
  errorMessage: string | null;
  osdVisible: boolean;
  sourceType: 'live' | 'movie' | 'episode';
  showNextEpisodeCardState: boolean;
  nextEpisode: Episode | null;
  onWatchNow: () => void;
  onDismiss: () => void;
}): React.ReactElement {
  return (
    <>
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

      {(diagnosis?.kind === 'libmpv-load-failed' || diagnosis?.kind === 'libmpv-open-failed') && (
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
          <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>
            {diagnosis.kind === 'libmpv-open-failed' ? 'libmpv failed to open' : 'libmpv failed to load'}
          </h3>
          <p style={{ margin: 0, color: '#888' }}>
            {diagnosis.kind === 'libmpv-open-failed'
              ? 'The origin stream did not start. Chromium playback is not a fallback.'
              : 'In-process libmpv is unavailable. Chromium playback is not a fallback.'}
          </p>
        </div>
      )}

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

      {showNextEpisodeCardState && nextEpisode && (
        <NextEpisodeCard
          episode={nextEpisode}
          onWatchNow={onWatchNow}
          onDismiss={onDismiss}
          visible={true}
        />
      )}

      {sourceType === 'live' && osdVisible && (
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
    </>
  );
}
