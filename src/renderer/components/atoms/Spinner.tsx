import React from 'react';

/**
 * Spinner atom — pure visual loading indicator.
 */
export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-4',
};

export function Spinner({ size = 'md', className = '', label = 'Loading' }: SpinnerProps): React.ReactElement {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block rounded-full border-white/30 border-t-white animate-spin ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}

export default Spinner;
