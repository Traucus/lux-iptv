import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { CategoryRow, type CategoryRowItem } from '../../components/molecules/CategoryRow';
import { ChannelCard } from '../../components/molecules/ChannelCard';
import { Spinner } from '../../components/atoms/Spinner';
import { useCatalogGrouped } from '../../queries/use-catalog';

export function LivePage(): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCatalogGrouped('live', 20);

  const onSidebarSelect = (section: SidebarSection): void => {
    switch (section) {
      case 'home': navigate('/'); break;
      case 'live': navigate('/live'); break;
      case 'movies': navigate('/movies'); break;
      case 'series': navigate('/series'); break;
      case 'settings': navigate('/ingest'); break;
    }
  };

  const renderChannelItem = (item: CategoryRowItem) => (
    <ChannelCard
      channel={{
        id: item.id,
        name: item.name,
        groupTitle: item.name,
        logo: item.cover,
        currentProgram: null,
      }}
      onSelect={(c) => navigate(`/watch/live/${c.id}`)}
    />
  );

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar active="live" onSelect={onSidebarSelect} />
      <main className="flex-1 overflow-y-auto p-6 safe-area">
        <h1 className="text-2xl font-bold text-white mb-6">Live TV</h1>
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Spinner size="lg" label="Loading live channels" />
          </div>
        ) : error ? (
          <p className="text-red-400">Failed to load channels: {(error as Error).message}</p>
        ) : !data?.groups?.length ? (
          <p className="text-gray-400">No live channels found.</p>
        ) : (
          data.groups.map((group) => (
            <CategoryRow
              key={group.title}
              title={group.title}
              totalCount={group.count}
              items={group.items.map((i) => ({ id: i.id, name: i.name, cover: i.cover }))}
              renderItem={renderChannelItem}
              onSeeAll={() => navigate(`/live?group=${encodeURIComponent(group.title)}`)}
            />
          ))
        )}
      </main>
    </div>
  );
}

export default LivePage;
