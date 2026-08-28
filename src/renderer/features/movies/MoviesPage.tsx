import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { CategoryRow, type CategoryRowItem } from '../../components/molecules/CategoryRow';
import { MoviePosterCard } from '../../components/molecules/MoviePosterCard';
import { Spinner } from '../../components/atoms/Spinner';
import { useCatalogGrouped } from '../../queries/use-catalog';

export function MoviesPage(): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCatalogGrouped('movie', 20);

  const onSidebarSelect = (section: SidebarSection): void => {
    switch (section) {
      case 'home': navigate('/'); break;
      case 'live': navigate('/live'); break;
      case 'movies': navigate('/movies'); break;
      case 'series': navigate('/series'); break;
    }
  };

  const renderMovieItem = (item: CategoryRowItem) => (
    <MoviePosterCard
      movie={{
        id: item.id,
        name: item.name,
        year: item.year,
        posterPath: item.cover,
        enriched: false,
      }}
      onSelect={(m) => navigate(`/content/${m.id}`)}
    />
  );

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
        ) : !data?.groups?.length ? (
          <p className="text-gray-400">No movies found.</p>
        ) : (
          data.groups.map((group) => (
            <CategoryRow
              key={group.title}
              title={group.title}
              totalCount={group.count}
              items={group.items.map((i) => ({ id: i.id, name: i.name, cover: i.cover, year: i.year }))}
              renderItem={renderMovieItem}
              onSeeAll={() => navigate(`/movies?group=${encodeURIComponent(group.title)}`)}
            />
          ))
        )}
      </main>
    </div>
  );
}

export default MoviesPage;
