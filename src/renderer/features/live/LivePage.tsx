import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { ChannelCard, type ChannelCardData } from '../../components/molecules/ChannelCard';
import { Spinner } from '../../components/atoms/Spinner';
import { useCatalogList } from '../../queries/use-catalog';

export function LivePage(): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCatalogList('live');

  const onSidebarSelect = (section: SidebarSection): void => {
    switch (section) {
      case 'home': navigate('/'); break;
      case 'live': navigate('/live'); break;
      case 'movies': navigate('/movies'); break;
      case 'series': navigate('/series'); break;
    }
  };

  const channels: ChannelCardData[] = (data?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    groupTitle: item.groupTitle,
    logo: item.posterUrl ?? item.cover,
    currentProgram: null,
  }));

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
        ) : channels.length === 0 ? (
          <p className="text-gray-400">No live channels found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {channels.map((ch) => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                onSelect={(c) => navigate(`/watch/live/${c.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default LivePage;
