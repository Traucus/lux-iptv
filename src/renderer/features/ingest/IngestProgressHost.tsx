import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ProgressOverlay, type IngestCounts, type IngestPhase } from '../../components/molecules/ProgressOverlay';
import { createLuxAPI } from '../../lib/api';

const api = createLuxAPI();
const ZERO: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };

function percentOf(phase: IngestPhase | null, counts: IngestCounts): number {
  if (phase === 'DONE') return 100;
  const total = counts.total || 1;
  const processed = counts.live + counts.movies + counts.series + counts.radio;
  return Math.min(99, Math.round((processed / total) * 100));
}

/**
 * App-level ingest overlay. Home/list refresh starts a job without navigating
 * to Settings; this host still shows live counts until DONE.
 */
export function IngestProgressHost(): React.ReactElement | null {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<IngestPhase | null>(null);
  const [counts, setCounts] = useState<IngestCounts>(ZERO);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = api.ingest.onProgress((p: Record<string, unknown>) => {
      const nextPhase = (p.phase as IngestPhase | undefined) ?? null;
      const nextCounts: IngestCounts = {
        live: (p.live as number) ?? 0,
        movies: (p.movies as number) ?? 0,
        series: (p.series as number) ?? 0,
        radio: (p.radio as number) ?? 0,
        total: (p.total as number) ?? 0,
      };
      setPhase(nextPhase);
      setCounts(nextCounts);
      if (nextPhase === 'ERROR') {
        setErrorMessage(typeof p.message === 'string' ? p.message : 'Ingestion failed');
      }
      if (nextPhase === 'DONE') {
        void queryClient.invalidateQueries({ queryKey: ['catalog'] });
        void queryClient.invalidateQueries({ queryKey: ['catalog-grouped'] });
        window.setTimeout(() => {
          setPhase(null);
          setCounts(ZERO);
        }, 2000);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  if (!phase) return null;

  return (
    <ProgressOverlay
      phase={phase}
      percent={percentOf(phase, counts)}
      counts={counts}
      errorMessage={errorMessage}
    />
  );
}

export default IngestProgressHost;
