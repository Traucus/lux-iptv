import React from 'react';

/**
 * CredentialFormTabs — tab switcher between Xtream Codes API and M3U Playlist URL.
 * Pure presentational; the form content is rendered by the parent.
 */
export type CredentialSource = 'xtream' | 'm3u';

export interface CredentialFormTabsProps {
  active: CredentialSource;
  onChange: (source: CredentialSource) => void;
  className?: string;
}

const TABS: Array<{ key: CredentialSource; label: string }> = [
  { key: 'xtream', label: 'Xtream Codes API' },
  { key: 'm3u', label: 'M3U Playlist URL' },
];

export function CredentialFormTabs({ active, onChange, className = '' }: CredentialFormTabsProps): React.ReactElement {
  return (
    <div role="tablist" aria-label="Ingest source" className={`flex gap-2 ${className}`}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.key}`}
            id={`tab-${tab.key}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={[
              'flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
              isActive
                ? 'bg-primary-500 text-white shadow-glow-sm'
                : 'bg-glass text-gray-300 hover:bg-glass-light border border-white/10',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default CredentialFormTabs;
