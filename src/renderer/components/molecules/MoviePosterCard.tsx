import React from 'react';
import { Focusable } from '../atoms/Focusable';

/**
 * MoviePosterCard — vertical poster card for movies.
 * Receives poster URL, title, year; click navigates to detail.
 */
export interface MoviePosterData {
  id: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  enriched: boolean;
}

export interface MoviePosterCardProps {
  movie: MoviePosterData;
  onSelect?: (movie: MoviePosterData) => void;
  className?: string;
}

export function MoviePosterCard({
  movie,
  onSelect,
  className = '',
}: MoviePosterCardProps): React.ReactElement {
  return (
    <Focusable
      onSelect={onSelect ? () => onSelect(movie) : undefined}
      className={`block w-44 flex-shrink-0 ${className}`}
      aria-label={`Movie ${movie.name}${movie.year ? ` (${movie.year})` : ''}`}
    >
      <div className="flex flex-col gap-2 p-2 rounded-xl bg-glass-light border border-white/10 hover:border-primary-500/40 transition-colors">
        <div className="relative aspect-[2/3] bg-surface-100 rounded-lg overflow-hidden">
          {movie.posterPath ? (
            <img
              src={movie.posterPath}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <PlaceholderArt label={movie.name} />
          )}
        </div>
        <div className="px-1">
          <p className="text-sm font-medium text-white truncate">{movie.name}</p>
          {movie.year ? <p className="text-xs text-gray-400">{movie.year}</p> : null}
        </div>
      </div>
    </Focusable>
  );
}

export function PlaceholderArt({ label, className = '' }: { label: string; className?: string }): React.ReactElement {
  const letter = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-200 to-surface-400 ${className}`}
    >
      <span className="text-5xl font-bold text-gray-600">{letter}</span>
    </div>
  );
}

export default MoviePosterCard;
