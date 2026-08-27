import React from 'react';
import { DetailHeader } from '../../components/organisms/DetailHeader';
import { Button } from '../../components/atoms/Button';
import { Badge } from '../../components/atoms/Badge';
import { formatRuntimeMinutes } from '../../lib/enrichment-merge';
import type { EnrichedCatalogItem } from '../../../shared/types/ipc';

export interface MovieDetailProps {
  item: EnrichedCatalogItem;
  onPlay?: () => void;
  onAddToFavorites?: () => void;
}

/**
 * MovieDetail — two-panel layout: poster (left) + metadata (right).
 * Falls back to placeholder + raw name when not enriched.
 *
 * When enrichment is available we render the TMDB synopsis, the resolved
 * genre tags, and the formatted runtime. In degraded mode (no enrichment)
 * missing fields are simply omitted per REQ-DEGRADED-3.
 */
export function MovieDetail({ item, onPlay, onAddToFavorites }: MovieDetailProps): React.ReactElement {
  const enriched = item.enrichmentStatus === 'enriched';
  const posterUrl = item.posterUrl ?? item.cover;
  const duration = formatRuntimeMinutes(item.runtime);

  return (
    <article className="flex flex-col gap-6">
      <DetailHeader
        title={item.name}
        subtitle={item.groupTitle}
        year={item.year}
        genres={item.genres}
        enriched={enriched}
        backdropUrl={item.backdropUrl}
      />

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 px-8 -mt-16 relative z-10">
        <div className="aspect-[2/3] w-full max-w-[300px] rounded-2xl overflow-hidden bg-glass border border-white/10 shadow-glass-lg">
          {posterUrl ? (
            <img src={posterUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-200 to-surface-400">
              <span className="text-7xl font-bold text-gray-600">
                {item.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {!enriched ? (
            <Badge variant="warning">No enriched metadata available</Badge>
          ) : null}

          <div className="flex items-center gap-3">
            {onPlay ? (
              <Button onClick={onPlay} variant="primary" size="lg">
                ▶ Play
              </Button>
            ) : null}
            {onAddToFavorites ? (
              <Button onClick={onAddToFavorites} variant="glass" size="lg">
                ♥ Add to Favorites
              </Button>
            ) : null}
          </div>

          {/* Genre tags from TMDB (or M3U group title fallback). */}
          {item.genres.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {item.genres.map((genre) => (
                <Badge key={genre} variant="default">
                  {genre}
                </Badge>
              ))}
            </div>
          ) : null}

          {/* Synopsis from TMDB overview (22 px per spec). */}
          {item.overview ? (
            <p className="text-[22px] leading-relaxed text-gray-100" data-testid="movie-synopsis">
              {item.overview}
            </p>
          ) : null}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {item.year ? (
              <>
                <dt className="text-gray-400">Year</dt>
                <dd className="text-white">{item.year}</dd>
              </>
            ) : null}
            {duration ? (
              <>
                <dt className="text-gray-400">Duration</dt>
                <dd className="text-white">{duration}</dd>
              </>
            ) : null}
            {item.groupTitle ? (
              <>
                <dt className="text-gray-400">Group</dt>
                <dd className="text-white">{item.groupTitle}</dd>
              </>
            ) : null}
            {item.voteAverage != null ? (
              <>
                <dt className="text-gray-400">Rating</dt>
                <dd className="text-amber-400 font-medium">★ {item.voteAverage.toFixed(1)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>
    </article>
  );
}

export default MovieDetail;
