import React from 'react';
import { Focusable } from '../atoms/Focusable';
import { PlaceholderArt } from './MoviePosterCard';

/**
 * SeriesPosterCard — same shape as MoviePosterCard but labeled for series context.
 */
export interface SeriesPosterData {
  id: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  seasonCount: number;
  enriched: boolean;
}

export interface SeriesPosterCardProps {
  series: SeriesPosterData;
  onSelect?: (series: SeriesPosterData) => void;
  className?: string;
}

export function SeriesPosterCard({
  series,
  onSelect,
  className = '',
}: SeriesPosterCardProps): React.ReactElement {
  return (
    <Focusable
      onSelect={onSelect ? () => onSelect(series) : undefined}
      className={`block w-44 flex-shrink-0 ${className}`}
      aria-label={`Series ${series.name}${series.year ? ` (${series.year})` : ''}`}
    >
      <div className="flex flex-col gap-2 p-2 rounded-xl bg-glass-light border border-white/10 hover:border-primary-500/40 transition-colors">
        <div className="relative aspect-[2/3] bg-surface-100 rounded-lg overflow-hidden">
          {series.posterPath ? (
            <img
              src={series.posterPath}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <PlaceholderArt label={series.name} />
          )}
        </div>
        <div className="px-1">
          <p className="text-sm font-medium text-white truncate">{series.name}</p>
          <p className="text-xs text-gray-400">
            {series.year ? `${series.year} · ` : ''}
            {series.seasonCount} season{series.seasonCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </Focusable>
  );
}

export default SeriesPosterCard;
