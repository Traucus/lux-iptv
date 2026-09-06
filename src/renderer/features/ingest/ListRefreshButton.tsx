import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/atoms/Spinner';
import { createLuxAPI } from '../../lib/api';
import { useHasSource } from '../../queries/use-source';

const api = createLuxAPI();

/** Chrome refresh on Home/Live/Movies/Series. Hidden when no source is saved. */
export function ListRefreshButton(): React.ReactElement | null {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const { data: hasSource } = useHasSource();
  if (!hasSource?.configured) return null;

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      const result = await api.ingest.refresh();
      if (result.error?.code === 'NOT_FOUND') {
        navigate('/ingest');
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex justify-end mb-4">
      <button
        type="button"
        onClick={() => {
          void handleRefresh();
        }}
        disabled={refreshing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-glass border border-white/10 text-gray-300 hover:text-white hover:border-primary-500/40 transition-colors text-sm disabled:opacity-50"
      >
        {refreshing ? (
          <Spinner size="sm" label="" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        )}
        {refreshing ? 'Actualizando…' : 'Actualizar listas'}
      </button>
    </div>
  );
}

export default ListRefreshButton;
