import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { ChannelCard, type ChannelCardData } from '../../components/molecules/ChannelCard';
import { Spinner } from '../../components/atoms/Spinner';
import { useCatalogList, useCatalogGroups } from '../../queries/use-catalog';

const PAGE_SIZE = 100;

export function LivePage(): React.ReactElement {
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [allChannels, setAllChannels] = useState<ChannelCardData[]>([]);

  const { data: groups } = useCatalogGroups('live');
  const { data, isLoading, error, isFetching } = useCatalogList('live', {
    limit: PAGE_SIZE,
    offset,
    groupTitle: selectedGroup || undefined,
  });

  React.useEffect(() => {
    if (data?.items) {
      if (offset === 0) {
        setAllChannels(data.items.map((item) => ({
          id: item.id,
          name: item.name,
          groupTitle: item.groupTitle,
          logo: item.posterUrl ?? item.cover,
          currentProgram: null,
        })));
      } else {
        setAllChannels((prev) => [
          ...prev,
          ...data.items.map((item) => ({
            id: item.id,
            name: item.name,
            groupTitle: item.groupTitle,
            logo: item.posterUrl ?? item.cover,
            currentProgram: null,
          })),
        ]);
      }
    }
  }, [data, offset]);

  const handleGroupChange = (group: string): void => {
    setSelectedGroup(group);
    setOffset(0);
    setAllChannels([]);
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
      <Sidebar active="live" onSelect={onSidebarSelect} />
      <main className="flex-1 overflow-y-auto p-6 safe-area">
        <h1 className="text-2xl font-bold text-white mb-4">Live TV</h1>

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
            <Spinner size="lg" label="Loading live channels" />
          </div>
        ) : error ? (
          <p className="text-red-400">Failed to load channels: {(error as Error).message}</p>
        ) : allChannels.length === 0 ? (
          <p className="text-gray-400">No live channels found.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {allChannels.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  onSelect={(c) => navigate(`/watch/live/${c.id}`)}
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

export default LivePage;
