import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import { Spinner } from '../../components/atoms/Spinner';
import { ListRefreshButton } from '../ingest/ListRefreshButton';
import { useCatalogList } from '../../queries/use-catalog';
import { useEpgNowNext } from '../../queries/use-epg-now-next';

function routeToSection(pathname: string): SidebarSection {
  if (pathname.startsWith('/live')) return 'live';
  if (pathname.startsWith('/movies')) return 'movies';
  if (pathname.startsWith('/series')) return 'series';
  if (pathname.startsWith('/epg')) return 'epg';
  if (pathname.startsWith('/ingest')) return 'settings';
  return 'home';
}

export function EpgPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading, error } = useCatalogList('live', { limit: 50 });
  const channelIds = data?.items.map((item) => item.id) ?? [];
  const { data: epgByChannel, isPending: epgPending } = useEpgNowNext(channelIds);

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
      case 'epg':
        navigate('/epg');
        break;
      case 'settings':
        navigate('/ingest');
        break;
    }
  };

  const loading = isLoading || (channelIds.length > 0 && epgPending);

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar active={routeToSection(location.pathname)} onSelect={onSidebarSelect} />
      <main className="flex-1 overflow-y-auto p-6 safe-area">
        <ListRefreshButton />
        <h1 className="text-2xl font-bold text-white mb-6">TV Guide</h1>
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Spinner size="lg" label="Loading guide" />
          </div>
        ) : error ? (
          <p className="text-red-400">Failed to load guide: {(error as Error).message}</p>
        ) : !data?.items.length ? (
          <p className="text-gray-400">No live channels found.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="epg-now-next-list">
            {data.items.map((channel) => {
              const epg = epgByChannel?.get(channel.id);
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-xl bg-glass-light border border-white/10 hover:border-primary-500/40 px-4 py-3 flex flex-col gap-1"
                    data-testid={`epg-row-${channel.id}`}
                    onClick={() => navigate(`/watch/live/${channel.id}`)}
                  >
                    <span className="text-white font-medium">{channel.name}</span>
                    <span className="text-sm text-gray-300 truncate">
                      {epg?.now?.title ?? 'No programme'}
                    </span>
                    {epg?.next?.title ? (
                      <span className="text-xs text-gray-500 truncate">Next: {epg.next.title}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

export default EpgPage;
