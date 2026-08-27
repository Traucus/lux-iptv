import React from 'react';

/**
 * OsdTopBar — Top bar showing back button, title, and resolution/audio badge.
 *
 * Design §7.5: OsdTopBar — back arrow, title, resolution/audio badge
 */

export interface OsdTopBarProps {
  /** Title to display (channel name, movie title, episode name) */
  title: string;
  /** Optional resolution badge (e.g., "1080p", "720p") */
  resolution?: string;
  /** Optional audio track badge (e.g., "English", "Español") */
  audioTrack?: string;
  /** Called when back button is pressed */
  onBack: () => void;
  /** Whether the OSD is visible (for CSS transitions) */
  visible: boolean;
  /** Custom className */
  className?: string;
}

export const OsdTopBar: React.FC<OsdTopBarProps> = ({
  title,
  resolution,
  audioTrack,
  onBack,
  visible,
  className = '',
}) => {
  return (
    <div
      className={`osd-top-bar ${visible ? 'visible' : 'hidden'} ${className}`.trim()}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 10,
      }}
      data-testid="osd-top-bar"
    >
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          transition: 'background 0.2s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.4)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
        data-testid="osd-back-button"
        aria-label="Back"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Title */}
      <div style={{ flex: 1, textAlign: 'center', padding: '0 24px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          data-testid="osd-title"
        >
          {title}
        </h2>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {resolution && (
          <span
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: '#fff',
            }}
            data-testid="osd-resolution-badge"
          >
            {resolution}
          </span>
        )}
        {audioTrack && (
          <span
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: '#fff',
            }}
            data-testid="osd-audio-badge"
          >
            {audioTrack}
          </span>
        )}
      </div>
    </div>
  );
};

export default OsdTopBar;