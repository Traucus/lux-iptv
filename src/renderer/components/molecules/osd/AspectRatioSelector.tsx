import React, { useState, useRef, useEffect } from 'react';

/**
 * AspectRatioSelector — Cycles through aspect ratios: 16:9 → 4:3 → Zoom → Fit
 *
 * Design §7.5: AspectRatioSelector — cycles via data-aspect attribute
 */

export type AspectRatio = '16:9' | '4:3' | 'zoom' | 'fit';

const ASPECT_RATIOS: AspectRatio[] = ['16:9', '4:3', 'zoom', 'fit'];

const ASPECT_LABELS: Record<AspectRatio, string> = {
  '16:9': '16:9',
  '4:3': '4:3',
  zoom: 'Zoom',
  fit: 'Fit',
};

export interface AspectRatioSelectorProps {
  /** Current aspect ratio */
  current: AspectRatio;
  /** Called when aspect ratio changes */
  onChange: (ratio: AspectRatio) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  current,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Toggle menu
  const toggleMenu = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  // Close menu
  const closeMenu = () => setIsOpen(false);

  // Handle selection
  const handleSelect = (ratio: AspectRatio) => {
    onChange(ratio);
    closeMenu();
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = ASPECT_RATIOS.indexOf(current);
        const nextIndex = (currentIndex + 1) % ASPECT_RATIOS.length;
        handleSelect(ASPECT_RATIOS[nextIndex]!);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = ASPECT_RATIOS.indexOf(current);
        const prevIndex = (currentIndex - 1 + ASPECT_RATIOS.length) % ASPECT_RATIOS.length;
        handleSelect(ASPECT_RATIOS[prevIndex]!);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const currentIndex = ASPECT_RATIOS.indexOf(current);
        const nextIndex = (currentIndex + 1) % ASPECT_RATIOS.length;
        handleSelect(ASPECT_RATIOS[nextIndex]!);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, current]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const buttonStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: '#fff',
    opacity: disabled ? 0.5 : 1,
    transition: 'background 0.2s, transform 0.1s',
  };

  return (
    <div
      className={`aspect-ratio-selector ${className}`.trim()}
      style={{ position: 'relative' }}
      data-testid="aspect-ratio-selector"
    >
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        disabled={disabled}
        style={buttonStyle}
        onMouseOver={(e) => {
          if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.4)';
        }}
        onMouseOut={(e) => {
          if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
        }}
        onMouseDown={(e) => {
          if (!disabled) e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          if (!disabled) e.currentTarget.style.transform = 'scale(1)';
        }}
        aria-label={`Aspect ratio: ${ASPECT_LABELS[current]}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid="aspect-ratio-button"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Aspect ratio"
          style={{
            position: 'absolute',
            bottom: '56px',
            right: 0,
            background: 'rgba(20,20,30,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '120px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            zIndex: 20,
          }}
          data-testid="aspect-ratio-menu"
        >
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              onClick={() => handleSelect(ratio)}
              role="option"
              aria-selected={ratio === current}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: ratio === current ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.875rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: disabled ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) => {
                if (!disabled && ratio !== current) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }
              }}
              onMouseOut={(e) => {
                if (!disabled && ratio !== current) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              disabled={disabled}
              data-testid={`aspect-ratio-option-${ratio.replace(':', '-')}`}
            >
              <span>{ASPECT_LABELS[ratio]}</span>
              {ratio === current && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AspectRatioSelector;