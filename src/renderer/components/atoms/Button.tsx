import React from 'react';

/**
 * Button variants following the Cinematic Glass design system.
 * Presentational atom — accepts className for extension.
 */
export type ButtonVariant = 'primary' | 'glass' | 'ghost' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 hover:bg-primary-600 text-white shadow-glow-sm hover:shadow-glow border border-transparent',
  glass:
    'bg-glass backdrop-blur-md text-white border border-white/10 hover:bg-glass-light shadow-glass-sm',
  ghost: 'bg-transparent text-white hover:bg-glass-light border border-transparent',
  danger:
    'bg-red-600 hover:bg-red-700 text-white border border-transparent shadow-glass-sm',
};

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-base rounded-lg',
  lg: 'px-6 py-3 text-lg rounded-xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <SpinnerInline /> : null}
      {children}
    </button>
  );
});

function SpinnerInline(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
    />
  );
}

export default Button;
