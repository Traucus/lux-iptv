import React, { useState } from 'react';
import { DetailHeader } from '../../components/organisms/DetailHeader';
import { EpisodeGrid } from '../../components/organisms/EpisodeGrid';
import { SeasonTab } from '../../components/molecules/SeasonTab';
import { Button } from '../../components/atoms/Button';
import { Badge } from '../../components/atoms/Badge';
import type { CatalogItem, SeriesDetail } from '../../../shared/types/ipc';

export interface SeriesDetailProps {
  series: SeriesDetail;
  onPlay?: () => void;
  onAddToFavorites?: () => void;
}

/**
 * SeriesDetail — poster + info + Season tabs + Episode grid.
 */
export function SeriesDetailView({
  series,
  onPlay,
  onAddToFavorites,
}: SeriesDetailProps): React.ReactElement {
  const enriched = series.series.enrichmentStatus === 'enriched';

  const sortedSeasons = [...series.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const initialSeason = sortedSeasons[0]?.seasonNumber ?? 1;

  const [activeSeason, setActiveSeason] = useState<number>(initialSeason);
  const currentSeason = sortedSeasons.find((s) => s.seasonNumber === activeSeason) ?? sortedSeasons[0];

  const episodes = (currentSeason?.episodes ?? []).map<{
    id: number;
    season: number;
    episode: number;
    name: string;
    thumbnailUrl: string | null;
    durationSec: number | null;
    watched: boolean;
  }>((ep: CatalogItem) => ({
    id: ep.id,
    season: currentSeason?.seasonNumber ?? 1,
    episode: ep.id,
    name: ep.name,
    thumbnailUrl: ep.cover,
    durationSec: null,
    watched: false,
  }));

  return (
    <article className="flex flex-col gap-6">
      <DetailHeader
        title={series.series.name}
        subtitle={series.series.groupTitle}
        year={series.series.year}
        enriched={enriched}
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
            {series.series.cover ? (
              <img src={series.series.cover} alt={series.series.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-200 to-surface-400">
                <span className="text-6xl font-bold text-gray-600">
                  {series.series.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 flex-1">
            {!enriched ? (
              <Badge variant="warning">No enriched metadata available</Badge>
            ) : null}
            {series.series.groupTitle ? (
              <p className="text-sm text-gray-400">Genre: {series.series.groupTitle}</p>
            ) : null}
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
