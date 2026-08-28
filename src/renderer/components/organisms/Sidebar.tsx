import React, { useState } from 'react';
import { SidebarNavItem } from '../molecules/SidebarNavItem';

export type SidebarSection = 'home' | 'live' | 'movies' | 'series' | 'settings';

export interface SidebarProps {
  active?: SidebarSection;
  onSelect?: (section: SidebarSection) => void;
  className?: string;
}

interface NavEntry {
  key: SidebarSection;
  label: string;
  icon: React.ReactNode;
}

const ICON_HOME = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const ICON_LIVE = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="7" width="20" height="15" rx="2" />
    <polyline points="17 2 12 7 7 2" />
  </svg>
);
const ICON_MOVIES = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);
const ICON_SERIES = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const ICON_SETTINGS = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/**
 * NAV_ENTRIES — only the entries that have an implemented route in this slice.
 *
 * REQ-NAV-DEAD-BUTTONS: Settings, Favorites, and Search have no working
 * routes or IPC handlers. They are intentionally omitted until their
 * respective slices land.
 */
const NAV_ENTRIES: NavEntry[] = [
  { key: 'home', label: 'Home', icon: ICON_HOME },
  { key: 'live', label: 'Live TV', icon: ICON_LIVE },
  { key: 'movies', label: 'Movies', icon: ICON_MOVIES },
  { key: 'series', label: 'Series', icon: ICON_SERIES },
  { key: 'settings', label: 'Settings', icon: ICON_SETTINGS },
];

export function Sidebar({ active = 'home', onSelect, className = '' }: SidebarProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const widthClass = expanded ? 'w-64' : 'w-20';

  return (
    <aside
      className={`relative h-full ${widthClass} flex-shrink-0 transition-[width] duration-300 glass border-r border-white/10 ${className}`}
      aria-label="Primary navigation"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <nav className="flex flex-col gap-1 p-3">
        {NAV_ENTRIES.map((entry) => (
          <SidebarNavItem
            key={entry.key}
            icon={entry.icon}
            label={entry.label}
            active={entry.key === active}
            expanded={expanded}
            onSelect={onSelect ? () => onSelect(entry.key) : undefined}
          />
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
