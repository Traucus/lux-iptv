import React from 'react';

/**
 * Base Input atom — presentational. Used directly or wrapped by TextField/PasswordField.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', invalid = false, ...rest },
  ref,
) {
  const classes = [
    'w-full px-4 py-2 bg-glass backdrop-blur-md rounded-lg text-white',
    'placeholder-gray-500 transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50',
    invalid
      ? 'border border-red-500/60 focus:ring-red-500/40 focus:border-red-500/60'
      : 'border border-white/10',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <input ref={ref} className={classes} aria-invalid={invalid || undefined} {...rest} />;
});

export default Input;
