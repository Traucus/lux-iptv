import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { SeriesPosterCard, type SeriesPosterData } from '../../components/molecules/SeriesPosterCard';
import { Spinner } from '../../components/atoms/Spinner';
import { useCatalogList } from '../../queries/use-catalog';

export function SeriesPage(): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCatalogList('series');

  const onSidebarSelect = (section: SidebarSection): void => {
    switch (section) {
      case 'home': navigate('/'); break;
      case 'live': navigate('/live'); break;
      case 'movies': navigate('/movies'); break;
      case 'series': navigate('/series'); break;
    }
  };

  const series: SeriesPosterData[] = (data?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    year: item.year,
    posterPath: item.posterUrl ?? item.cover,
    seasonCount: 1,
    enriched: item.enrichmentStatus === 'enriched',
  }));

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar active="series" onSelect={onSidebarSelect} />
      <main className="flex-1 overflow-y-auto p-6 safe-area">
        <h1 className="text-2xl font-bold text-white mb-6">Series</h1>
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Spinner size="lg" label="Loading series" />
          </div>
        ) : error ? (
          <p className="text-red-400">Failed to load series: {(error as Error).message}</p>
        ) : series.length === 0 ? (
          <p className="text-gray-400">No series found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {series.map((s) => (
              <SeriesPosterCard
                key={s.id}
                series={s}
                onSelect={(item) => navigate(`/content/${item.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default SeriesPage;
