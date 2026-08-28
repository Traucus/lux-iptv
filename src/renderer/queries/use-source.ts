import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createLuxAPI } from '../lib/api';
import type { HasSource, SourceSummary } from '../../shared/types/ipc';

const api = createLuxAPI();

export function useHasSource(): UseQueryResult<HasSource> {
  return useQuery<HasSource>({
    queryKey: ['config', 'hasSource'] as const,
    queryFn: async () => {
      const result = await api.config.hasSource();
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
  });
}

export function useSourceSummary(): UseQueryResult<SourceSummary> {
  return useQuery<SourceSummary>({
    queryKey: ['config', 'sourceSummary'] as const,
    queryFn: async () => {
      const result = await api.config.sourceSummary();
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
  });
}
