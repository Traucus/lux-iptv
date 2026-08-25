import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createLuxAPI } from '../lib/api';
import type { EnrichmentStatus } from '../../shared/types/ipc';

const api = createLuxAPI();

/**
 * useEnrichmentStatus — polls enrichment status every 2 s while running, stops when idle.
 */
export function useEnrichmentStatus(): UseQueryResult<EnrichmentStatus> {
  return useQuery<EnrichmentStatus>({
    queryKey: ['enrichment', 'status'] as const,
    queryFn: async () => {
      const result = await api.enrichment.getStatus();
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isRunning ? 2000 : false;
    },
  });
}
