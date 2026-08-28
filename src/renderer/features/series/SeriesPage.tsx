import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { MoviePosterCard, type MoviePosterData } from '../../components/molecules/MoviePosterCard';
import { Spinner } from '../../components/atoms/Spinner';
import { useCatalogList, useCatalogGroups } from '../../queries/use-catalog';

const PAGE_SIZE = 100;

export function SeriesPage(): React.ReactElement {
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [allSeries, setAllSeries] = useState<MoviePosterData[]>([]);

  const { data: groups } = useCatalogGroups('series');
  const { data, isLoading, error, isFetching } = useCatalogList('series', {
    limit: PAGE_SIZE,
    offset,
    groupTitle: selectedGroup || undefined,
  });

  React.useEffect(() => {
    if (data?.items) {
      if (offset === 0) {
        setAllSeries(data.items.map((item) => ({
          id: item.id,
          name: item.name,
          year: item.year,
          posterPath: item.posterUrl ?? item.cover,
          enriched: item.enrichmentStatus === 'enriched',
        })));
      } else {
        setAllSeries((prev) => [
          ...prev,
          ...data.items.map((item) => ({
            id: item.id,
            name: item.name,
            year: item.year,
            posterPath: item.posterUrl ?? item.cover,
            enriched: item.enrichmentStatus === 'enriched',
          })),
        ]);
      }
    }
  }, [data, offset]);

  const handleGroupChange = (group: string): void => {
    setSelectedGroup(group);
    setOffset(0);
    setAllSeries([]);
  };

  const hasMore = data ? offset + PAGE_SIZE < data.total : false;

  const onSidebarSelect = (section: SidebarSection): void => {
    switch (section) {
      case 'home': navigate('/'); break;
      case 'live': navigate('/live'); break;
      case 'movies': navigate('/movies'); break;
      case 'series': navigate('/series'); break;
    }
  };

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar active="series" onSelect={onSidebarSelect} />
      <main className="flex-1 overflow-y-auto p-6 safe-area">
        <h1 className="text-2xl font-bold text-white mb-4">Series</h1>

        {groups && groups.length > 0 && (
          <div className="mb-4">
            <select
              value={selectedGroup}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="bg-surface-elevated text-white border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="">All categories ({data?.total ?? '...'})</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        )}

        {isLoading && offset === 0 ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Spinner size="lg" label="Loading series" />
          </div>
        ) : error ? (
          <p className="text-red-400">Failed to load series: {(error as Error).message}</p>
        ) : allSeries.length === 0 ? (
          <p className="text-gray-400">No series found.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {allSeries.map((s) => (
                <MoviePosterCard
                  key={s.id}
                  movie={s}
                  onSelect={(item) => navigate(`/content/${item.id}`)}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                  disabled={isFetching}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded disabled:opacity-50"
                >
                  {isFetching ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default SeriesPage;
