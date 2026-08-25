import React from 'react';

/**
 * ProgressBar atom — pure visual horizontal progress indicator.
 */
export interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  label?: string;
  showPercent?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  className = '',
  label,
  showPercent = false,
}: ProgressBarProps): React.ReactElement {
  const safeMax = Math.max(max, 1);
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));

  return (
    <div className={`w-full ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={value} aria-label={label}>
      <div className="w-full h-2 bg-glass-light rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercent ? (
        <div className="mt-1 text-xs text-gray-400 text-right">{Math.round(pct)}%</div>
      ) : null}
    </div>
  );
}

export default ProgressBar;
