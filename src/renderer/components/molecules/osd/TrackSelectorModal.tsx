import React, { useEffect, useRef } from 'react';

/**
 * TrackSelectorModal — Modal for selecting audio or subtitle tracks.
 *
 * Design §7.5: TrackSelectorModal — dual list (audio + subtitles)
 */

export interface Track {
  id: number;
  name: string;
  lang?: string;
}

export interface TrackSelectorModalProps {
  /** List of available tracks */
  tracks: Track[];
  /** Currently selected track index (-1 for off/none) */
  selectedIndex: number;
  /** Called when a track is selected */
  onSelect: (index: number) => void;
  /** Called when modal should close */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Whether to show "Off" option (for subtitles) */
  showOffOption?: boolean;
  /** Position anchor element (for positioning) */
  anchorRef?: React.RefObject<HTMLElement>;
}

export const TrackSelectorModal: React.FC<TrackSelectorModalProps> = ({
  tracks,
  selectedIndex,
  onSelect,
  onClose,
  title,
  showOffOption = false,
  anchorRef,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => modal.removeEventListener('keydown', handleTab);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const allTracks = showOffOption ? [{ id: -1, name: 'Off' }, ...tracks] : tracks;

  // Position near anchor if provided
  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: anchorRef?.current ? undefined : '120px',
    left: anchorRef?.current ? undefined : '50%',
    transform: anchorRef?.current ? undefined : 'translateX(-50%)',
    zIndex: 20,
    ...(anchorRef?.current && {
      bottom: '60px',
      left: 'auto',
      right: '24px',
    }),
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={modalStyle}
      data-testid="track-selector-modal"
    >
      <div
        style={{
          background: 'rgba(20,20,30,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '8px',
          minWidth: '200px',
          maxWidth: '300px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            marginBottom: '4px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Track list */}
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {allTracks.map((track, index) => (
            <button
              key={track.id}
              onClick={() => {
                onSelect(index);
                onClose();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: index === selectedIndex ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }
              }}
              onMouseOut={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              data-testid={`track-option-${index}`}
            >
              <span>{track.lang ? `[${track.lang}] ${track.name}` : track.name}</span>
              {index === selectedIndex && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrackSelectorModal;