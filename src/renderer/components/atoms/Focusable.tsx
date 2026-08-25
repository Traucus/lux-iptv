import React from 'react';
import { SpatialNavigationFocusableView } from 'react-tv-space-navigation';

/**
 * Focusable — D-Pad / focus-aware wrapper around SpatialNavigationFocusableView.
 *
 * On TV remote or keyboard, focus moves between Focusable items.
 * On focus, scales to 1.05x with a blue border (Cinematic Glass design system).
 */
export interface FocusableProps {
  onSelect?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Optional aria-label for accessibility */
  'aria-label'?: string;
}

const BASE_FOCUS_CLASSES =
  'transition-all duration-200 focus:outline-none focus-visible:outline-none';

const FOCUS_RING =
  'data-[focused=true]:scale-105 data-[focused=true]:ring-2 data-[focused=true]:ring-primary-500 data-[focused=true]:shadow-glow';

export function Focusable({
  onSelect,
  onFocus,
  onBlur,
  disabled = false,
  className = '',
  children,
  ...rest
}: FocusableProps): React.ReactElement {
  const classes = [BASE_FOCUS_CLASSES, FOCUS_RING, className].filter(Boolean).join(' ');

  return (
    <SpatialNavigationFocusableView
      onSelect={disabled ? undefined : onSelect}
      onFocus={onFocus}
      onBlur={onBlur}
      className={classes}
      aria-label={rest['aria-label']}
    >
      {children}
    </SpatialNavigationFocusableView>
  );
}

export default Focusable;
