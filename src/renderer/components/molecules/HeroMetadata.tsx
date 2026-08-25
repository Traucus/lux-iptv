import React from 'react';
import { Button } from '../atoms/Button';

/**
 * HeroMetadata — title/year/genre/synopsis with action buttons.
 * Used by HeroBanner organism and detail views.
 */
export interface HeroMetadataData {
  title: string;
  year: number | null;
  genres: string[];
  synopsis: string | null;
  rating: number | null;
}

export interface HeroMetadataProps {
  data: HeroMetadataData;
  onPlay?: () => void;
  onMoreInfo?: () => void;
  className?: string;
}

export function HeroMetadata({ data, onPlay, onMoreInfo, className = '' }: HeroMetadataProps): React.ReactElement {
  return (
    <div className={`flex flex-col gap-4 max-w-2xl ${className}`}>
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md font-bold text-white leading-tight">{data.title}</h1>
        <div className="flex items-center gap-3 text-sm text-gray-300">
          {data.year ? <span>{data.year}</span> : null}
          {data.rating !== null ? (
            <span className="text-amber-400 font-medium">★ {data.rating.toFixed(1)}</span>
          ) : null}
          {data.genres.length > 0 ? <span>· {data.genres.slice(0, 3).join(', ')}</span> : null}
        </div>
      </div>
      {data.synopsis ? (
        <p className="text-base text-gray-200 line-clamp-3">{data.synopsis}</p>
      ) : null}
      <div className="flex items-center gap-3">
        {onPlay ? (
          <Button onClick={onPlay} size="lg" variant="primary" aria-label={`Play ${data.title}`}>
            ▶ Play
          </Button>
        ) : null}
        {onMoreInfo ? (
          <Button onClick={onMoreInfo} size="lg" variant="glass" aria-label={`More info about ${data.title}`}>
            More Info
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default HeroMetadata;
