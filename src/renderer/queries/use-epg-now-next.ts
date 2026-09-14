import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createLuxAPI } from '../lib/api';
import type { EpgNowNextItem } from '../../shared/types/ipc';

const api = createLuxAPI();

export function useEpgNowNext(channelIds: readonly number[]): UseQueryResult<Map<number, EpgNowNextItem>> {
  const key = [...channelIds].sort((a, b) => a - b).join(',');
  return useQuery({
    queryKey: ['epg', 'nowNext', key] as const,
    queryFn: async () => {
      const result = await api.epg.nowNext({ channelIds: [...channelIds] });
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      const map = new Map<number, EpgNowNextItem>();
      for (const item of result.data.items) {
        map.set(item.channelId, item);
      }
      return map;
    },
    enabled: channelIds.length > 0,
    staleTime: 60_000,
  });
}
