import React from 'react';

/**
 * SeasonTab — selectable tab representing a single season of a series.
 */
export interface SeasonTabProps {
  seasonNumber: number;
  active?: boolean;
  episodeCount?: number;
  onSelect?: () => void;
  className?: string;
}

export function SeasonTab({
  seasonNumber,
  active = false,
  episodeCount,
  onSelect,
  className = '',
}: SeasonTabProps): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={[
        'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
        active
          ? 'bg-primary-500 text-white shadow-glow-sm'
          : 'bg-glass text-gray-300 hover:bg-glass-light border border-white/10',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      Season {seasonNumber}
      {typeof episodeCount === 'number' ? (
        <span className="ml-2 text-xs opacity-70">({episodeCount})</span>
      ) : null}
    </button>
  );
}

export default SeasonTab;
