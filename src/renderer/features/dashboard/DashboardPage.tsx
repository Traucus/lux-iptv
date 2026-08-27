import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { HeroBanner } from '../../components/organisms/HeroBanner';
import { ContentCarousel } from '../../components/organisms/ContentCarousel';
import { Spinner } from '../../components/atoms/Spinner';
import { ChannelCard, type ChannelCardData } from '../../components/molecules/ChannelCard';
import { MoviePosterCard, type MoviePosterData } from '../../components/molecules/MoviePosterCard';
import { SeriesPosterCard, type SeriesPosterData } from '../../components/molecules/SeriesPosterCard';
import { useDashboardData } from './useDashboardData';
import type { EnrichedCatalogItem } from '../../../shared/types/ipc';

function itemToMovie(item: EnrichedCatalogItem): MoviePosterData {
  return {
    id: item.id,
    name: item.name,
    year: item.year,
    posterPath: item.posterUrl ?? item.cover,
    enriched: item.enrichmentStatus === 'enriched',
  };
}

function itemToSeries(item: EnrichedCatalogItem): SeriesPosterData {
  return {
    id: item.id,
    name: item.name,
    year: item.year,
    posterPath: item.posterUrl ?? item.cover,
    seasonCount: 1,
    enriched: item.enrichmentStatus === 'enriched',
  };
}

function itemToChannel(item: EnrichedCatalogItem): ChannelCardData {
  return {
    id: item.id,
    name: item.name,
    groupTitle: item.groupTitle,
    logo: item.posterUrl ?? item.cover,
    currentProgram: null,
  };
}

/**
 * DashboardPage — Screen 3 home dashboard with sidebar + hero + carousels.
 * Empty carousels are hidden. Degraded mode = empty data + fallback gradient hero.
 *
 * Featured content (hero) reads from IndexedDB enrichment so the synopsis,
 * backdrop, and rating are populated when TMDB has hydrated the record.
 */
export function DashboardPage(): React.ReactElement {
  const navigate = useNavigate();
  const data = useDashboardData();

  const onSidebarSelect = (section: SidebarSection): void => {
    switch (section) {
      case 'home':
        navigate('/');
        break;
      case 'live':
        navigate('/live');
        break;
      case 'movies':
        navigate('/movies');
        break;
      case 'series':
        navigate('/series');
        break;
    }
  };

  const featured: EnrichedCatalogItem | undefined = data.recentMovies[0];

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar active="home" onSelect={onSidebarSelect} />

      <main className="flex-1 overflow-y-auto p-6 safe-area">
        {data.loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Spinner size="lg" label="Loading dashboard" />
          </div>
        ) : data.error ? (
          <ErrorState message={data.error.message} onRetry={() => window.location.reload()} />
        ) : (
          <div className="flex flex-col gap-8">
            {featured ? (
              <HeroBanner
                data={{
                  title: featured.name,
                  year: featured.year,
                  genres: featured.genres,
                  synopsis: featured.overview,
                  rating: featured.voteAverage,
                }}
                backdropUrl={featured.backdropUrl}
                onPlay={() => navigate(`/content/${featured.id}`)}
                onMoreInfo={() => navigate(`/content/${featured.id}`)}
              />
            ) : (
              <DegradedHero onAddSource={() => navigate('/ingest')} />
            )}

            <ContentCarousel
              title="Continue Watching"
              items={data.continueWatching.map(itemToMovie)}
              renderItem={(movie) => (
                <MoviePosterCard
                  key={movie.id}
                  movie={movie}
                  onSelect={(m) => navigate(`/content/${m.id}`)}
                />
              )}
            />

            <ContentCarousel
              title="Live Channels"
              items={data.liveChannels.map(itemToChannel)}
              renderItem={(ch) => (
                <ChannelCard key={ch.id} channel={ch} onSelect={(channel) => navigate(`/watch/live/${channel.id}`)} />
              )}
            />

            <ContentCarousel
              title="Recent Movies"
              items={data.recentMovies.map(itemToMovie)}
              renderItem={(movie) => (
                <MoviePosterCard
                  key={movie.id}
                  movie={movie}
                  onSelect={(m) => navigate(`/content/${m.id}`)}
                />
              )}
            />

            <ContentCarousel
              title="Recent Series"
              items={data.recentSeries.map(itemToSeries)}
              renderItem={(series) => (
                <SeriesPosterCard
                  key={series.id}
                  series={series}
                  onSelect={(s) => navigate(`/content/${s.id}`)}
                />
              )}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-red-400 text-lg">Failed to load dashboard</p>
      <p className="text-gray-400 text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

function DegradedHero({ onAddSource }: { onAddSource: () => void }): React.ReactElement {
  return (
    <section
      className="relative w-full h-[45vh] min-h-[360px] overflow-hidden rounded-2xl bg-gradient-to-br from-surface-200 via-surface-300 to-surface-400"
      aria-label="Welcome to Lux IPTV"
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
        <div className="flex flex-col gap-4 max-w-lg">
          <h2 className="text-display-sm font-bold text-white">Welcome to Lux IPTV</h2>
          <p className="text-gray-300">
            Add an IPTV source to start browsing your channels, movies, and series.
          </p>
          <button
            type="button"
            onClick={onAddSource}
            className="self-center px-6 py-3 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors font-medium"
          >
            Add Source
          </button>
        </div>
      </div>
    </section>
  );
}

export default DashboardPage;
