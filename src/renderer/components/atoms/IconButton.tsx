import React from 'react';

/**
 * IconButton — circular button for icon-only actions.
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'glass' | 'ghost' | 'primary';
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const VARIANT_CLASSES: Record<'glass' | 'ghost' | 'primary', string> = {
  glass:
    'bg-glass backdrop-blur-md border border-white/10 hover:bg-glass-light text-white shadow-glass-sm',
  ghost: 'bg-transparent text-white hover:bg-glass-light border border-transparent',
  primary:
    'bg-primary-500 hover:bg-primary-600 text-white border border-transparent shadow-glow-sm',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className = '', variant = 'glass', size = 'md', children, ...rest },
  ref,
) {
  const classes = [
    'inline-flex items-center justify-center rounded-full transition-all duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} className={classes} {...rest}>
      {children}
    </button>
  );
});

export default IconButton;
