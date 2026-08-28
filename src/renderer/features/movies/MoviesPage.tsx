import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { MoviePosterCard, type MoviePosterData } from '../../components/molecules/MoviePosterCard';
import { Spinner } from '../../components/atoms/Spinner';
import { useCatalogList } from '../../queries/use-catalog';

export function MoviesPage(): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCatalogList('movie');

  const onSidebarSelect = (section: SidebarSection): void => {
    switch (section) {
      case 'home': navigate('/'); break;
      case 'live': navigate('/live'); break;
      case 'movies': navigate('/movies'); break;
      case 'series': navigate('/series'); break;
    }
  };

  const movies: MoviePosterData[] = (data?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    year: item.year,
    posterPath: item.posterUrl ?? item.cover,
    enriched: item.enrichmentStatus === 'enriched',
  }));

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar active="movies" onSelect={onSidebarSelect} />
      <main className="flex-1 overflow-y-auto p-6 safe-area">
        <h1 className="text-2xl font-bold text-white mb-6">Movies</h1>
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Spinner size="lg" label="Loading movies" />
          </div>
        ) : error ? (
          <p className="text-red-400">Failed to load movies: {(error as Error).message}</p>
        ) : movies.length === 0 ? (
          <p className="text-gray-400">No movies found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {movies.map((m) => (
              <MoviePosterCard
                key={m.id}
                movie={m}
                onSelect={(movie) => navigate(`/content/${movie.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default MoviesPage;
