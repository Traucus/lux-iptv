import React from 'react';
import { Focusable } from '../atoms/Focusable';

/**
 * SidebarNavItem — single navigation row inside the Sidebar organism.
 */
export interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  expanded?: boolean;
  onSelect?: () => void;
  className?: string;
}

export function SidebarNavItem({
  icon,
  label,
  active = false,
  expanded = false,
  onSelect,
  className = '',
}: SidebarNavItemProps): React.ReactElement {
  return (
    <Focusable
      onSelect={onSelect}
      className={`block ${className}`}
      aria-label={label}
    >
      <div
        data-active={active || undefined}
        className={[
          'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer',
          active
            ? 'bg-primary-500/15 text-white'
            : 'text-gray-300 hover:bg-glass-light hover:text-white',
        ].join(' ')}
      >
        {active ? (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-primary-500" aria-hidden="true" />
        ) : null}
        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icon}</span>
        {expanded ? <span className="text-sm font-medium truncate">{label}</span> : null}
      </div>
    </Focusable>
  );
}

export default SidebarNavItem;
