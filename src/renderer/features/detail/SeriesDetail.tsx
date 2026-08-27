import React, { useState } from 'react';
import { DetailHeader } from '../../components/organisms/DetailHeader';
import { EpisodeGrid } from '../../components/organisms/EpisodeGrid';
import { SeasonTab } from '../../components/molecules/SeasonTab';
import { Button } from '../../components/atoms/Button';
import { Badge } from '../../components/atoms/Badge';
import { formatRuntimeMinutes } from '../../lib/enrichment-merge';
import type { Episode, EnrichedCatalogItem, SeriesDetail } from '../../../shared/types/ipc';

export interface SeriesDetailProps {
  series: SeriesDetail;
  /**
   * Enriched view of `series.series` produced by `useEnrichedContent`. When
   * omitted (degraded mode) the component falls back to the raw CatalogItem.
   */
  enrichedSeries?: EnrichedCatalogItem | null;
  onPlay?: () => void;
  onAddToFavorites?: () => void;
}

/**
 * SeriesDetail — poster + info + Season tabs + Episode grid.
 *
 * Episode numbers are taken from the Episode DTO's `episode` field, not the
 * SQLite primary key (Fix for verify report #2). When enrichment is available
 * we render the TMDB backdrop, synopsis, genres, and resolved season count.
 */
export function SeriesDetailView({
  series,
  enrichedSeries,
  onPlay,
  onAddToFavorites,
}: SeriesDetailProps): React.ReactElement {
  const view: EnrichedCatalogItem = enrichedSeries ?? {
    ...series.series,
    enrichmentStatus: 'pending',
    overview: null,
    posterUrl: null,
    backdropUrl: null,
    voteAverage: null,
    runtime: null,
    genres: series.series.groupTitle ? [series.series.groupTitle] : [],
  };
  const enriched = view.enrichmentStatus === 'enriched';

  const sortedSeasons = [...series.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const initialSeason = sortedSeasons[0]?.seasonNumber ?? 1;

  const [activeSeason, setActiveSeason] = useState<number>(initialSeason);
  const currentSeason = sortedSeasons.find((s) => s.seasonNumber === activeSeason) ?? sortedSeasons[0];

  // Map the Episode DTO into the EpisodeGrid's data shape. The fix from the
  // verify report is here: we use `ep.episode` (the real episode number) and
  // not `ep.id` (the SQLite primary key).
  const episodes = (currentSeason?.episodes ?? []).map<{
    id: number;
    season: number;
    episode: number;
    name: string;
    thumbnailUrl: string | null;
    durationSec: number | null;
    watched: boolean;
  }>((ep: Episode) => ({
    id: ep.id,
    season: ep.season,
    episode: ep.episode,
    name: ep.name,
    thumbnailUrl: ep.cover,
    durationSec: null,
    watched: false,
  }));

  const seasonCount = sortedSeasons.length;
  const duration = formatRuntimeMinutes(view.runtime);

  return (
    <article className="flex flex-col gap-6">
      <DetailHeader
        title={view.name}
        subtitle={view.groupTitle}
        year={view.year}
        genres={view.genres}
        enriched={enriched}
        backdropUrl={view.backdropUrl}
      >
        {onPlay ? (
          <Button onClick={onPlay} variant="primary" size="lg">
            ▶ Play
          </Button>
        ) : null}
        {onAddToFavorites ? (
          <Button onClick={onAddToFavorites} variant="glass" size="lg">
            ♥ Favorites
          </Button>
        ) : null}
      </DetailHeader>

      <div className="px-8 -mt-12 relative z-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start gap-6">
          <div className="aspect-[2/3] w-48 rounded-2xl overflow-hidden bg-glass border border-white/10 shadow-glass flex-shrink-0">
            {view.posterUrl ?? view.cover ? (
              <img src={(view.posterUrl ?? view.cover) as string} alt={view.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-200 to-surface-400">
                <span className="text-6xl font-bold text-gray-600">
                  {view.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 flex-1">
            {!enriched ? (
              <Badge variant="warning">No enriched metadata available</Badge>
            ) : null}

            {view.genres.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {view.genres.map((genre) => (
                  <Badge key={genre} variant="default">
                    {genre}
                  </Badge>
                ))}
              </div>
            ) : null}

            {view.overview ? (
              <p className="text-[22px] leading-relaxed text-gray-100" data-testid="series-synopsis">
                {view.overview}
              </p>
            ) : null}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {view.year ? (
                <>
                  <dt className="text-gray-400">Year</dt>
                  <dd className="text-white">{view.year}</dd>
                </>
              ) : null}
              {seasonCount > 0 ? (
                <>
                  <dt className="text-gray-400">Seasons</dt>
                  <dd className="text-white">{seasonCount}</dd>
                </>
              ) : null}
              {duration ? (
                <>
                  <dt className="text-gray-400">Episode length</dt>
                  <dd className="text-white">{duration}</dd>
                </>
              ) : null}
              {view.groupTitle ? (
                <>
                  <dt className="text-gray-400">Group</dt>
                  <dd className="text-white">{view.groupTitle}</dd>
                </>
              ) : null}
              {view.voteAverage != null ? (
                <>
                  <dt className="text-gray-400">Rating</dt>
                  <dd className="text-amber-400 font-medium">★ {view.voteAverage.toFixed(1)}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </div>
      </div>

      <section className="px-8 pb-12" aria-label="Seasons">
        <div role="tablist" className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {sortedSeasons.map((season) => (
            <SeasonTab
              key={season.seasonNumber}
              seasonNumber={season.seasonNumber}
              active={season.seasonNumber === activeSeason}
              episodeCount={season.episodes.length}
              onSelect={() => setActiveSeason(season.seasonNumber)}
            />
          ))}
        </div>
        <EpisodeGrid episodes={episodes} />
      </section>
    </article>
  );
}

export default SeriesDetailView;
