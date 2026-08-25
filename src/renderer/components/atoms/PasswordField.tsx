import React from 'react';
import Input from './Input';

/**
 * PasswordField — TextField-like input with show/hide toggle.
 * Pure presentational; receives visibility state and toggle handler.
 */
export interface PasswordFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  visible?: boolean;
  onToggleVisible?: () => void;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  autoComplete = 'current-password',
  disabled,
  className = '',
  visible = false,
  onToggleVisible,
}: PasswordFieldProps): React.ReactElement {
  const inputId = id ?? `pf-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const hasError = Boolean(error);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-gray-200">
        {label}
        {required ? <span className="text-red-400 ml-1" aria-hidden="true">*</span> : null}
      </label>
      <div className="relative">
        <Input
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          invalid={hasError}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={hasError ? `${inputId}-error` : undefined}
          className="pr-12"
        />
        {onToggleVisible ? (
          <button
            type="button"
            onClick={onToggleVisible}
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-glass-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </div>
      {hasError ? (
        <p id={`${inputId}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EyeIcon(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export default PasswordField;
