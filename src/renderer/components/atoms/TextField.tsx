import React from 'react';
import Input from './Input';

/**
 * TextField — Input + label + inline error message.
 * Presentational atom: receives validation state and emits change events.
 */
export interface TextFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  error?: string | null;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  required,
  autoComplete,
  disabled,
  className = '',
}: TextFieldProps): React.ReactElement {
  const inputId = id ?? `tf-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const hasError = Boolean(error);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-gray-200">
        {label}
        {required ? <span className="text-red-400 ml-1" aria-hidden="true">*</span> : null}
      </label>
      <Input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        invalid={hasError}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-describedby={hasError ? `${inputId}-error` : undefined}
      />
      {hasError ? (
        <p id={`${inputId}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default TextField;
