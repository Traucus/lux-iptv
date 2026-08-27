import React, { useState, useEffect } from 'react';
import type { Episode } from '../../../shared/types/ipc';

/**
 * NextEpisodeCard — Overlay shown at 95% playback progress for series episodes.
 *
 * Design §7.5: NextEpisodeCard — countdown, navigate on expiry, dismiss
 */

export interface NextEpisodeCardProps {
  /** Next episode to show (null to hide) */
  episode: Episode | null;
  /** Called when user clicks "Watch Now" or countdown expires */
  onWatchNow: () => void;
  /** Called when user dismisses the card */
  onDismiss: () => void;
  /** Whether the card should be visible */
  visible: boolean;
}

export const NextEpisodeCard: React.FC<NextEpisodeCardProps> = ({
  episode,
  onWatchNow,
  onDismiss,
  visible,
}) => {
  const [countdown, setCountdown] = useState(10);

  // Reset countdown when visibility changes to true
  useEffect(() => {
    if (visible) {
      setCountdown(10);
    }
  }, [visible]);

  // Countdown timer
  useEffect(() => {
    if (!visible || !episode) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onWatchNow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, episode, onWatchNow]);

  // Keyboard dismiss (ESC/Back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        onDismiss();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onDismiss]);

  if (!visible || !episode) return null;

  return (
    <div
      className="next-episode-card"
      style={{
        position: 'fixed',
        bottom: '120px',
        right: '24px',
        width: '320px',
        background: 'rgba(20,20,30,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'slideIn 0.3s ease-out',
      }}
      data-testid="next-episode-card"
    >
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {episode.cover && (
            <img
              src={episode.cover}
              alt=""
              style={{ width: '64px', height: '36px', borderRadius: '4px', objectFit: 'cover' }}
            />
          )}
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>
              Next Episode
            </p>
            <h4 style={{ margin: '4px 0 0', fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
              S{episode.season}E{episode.episode}: {episode.name}
            </h4>
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '4px',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Dismiss"
          data-testid="dismiss-button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onWatchNow}
          style={{
            flex: 1,
            padding: '10px',
            background: '#fff',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#e0e0e0')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#fff')}
          data-testid="watch-now-button"
        >
          Watch Now
        </button>
        <div
          style={{
            width: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1.25rem',
          }}
          data-testid="countdown"
        >
          {countdown}s
        </div>
      </div>
    </div>
  );
};

export default NextEpisodeCard;