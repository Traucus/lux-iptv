import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-glass-light text-gray-200 border-white/10',
  success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  danger: 'bg-red-500/20 text-red-300 border-red-500/40',
  info: 'bg-primary-500/20 text-primary-200 border-primary-500/40',
};

export function Badge({ variant = 'default', className = '', children }: BadgeProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;
