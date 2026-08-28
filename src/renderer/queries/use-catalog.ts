import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { createLuxAPI } from '../lib/api';
import type {
  CatalogListInput,
  CatalogListOutput,
  CatalogType,
  CatalogGetByIdInput,
  CatalogItem,
  SeriesDetail,
} from '../../shared/types/ipc';

const api = createLuxAPI();

/**
 * useCatalogList — fetches a paginated list of catalog items of a given type.
 * Query key: ['catalog', type, params]
 */
export function useCatalogList(
  type: CatalogType,
  params: Omit<CatalogListInput, 'type'> = {},
  options?: Partial<UseQueryOptions<CatalogListOutput>>,
): UseQueryResult<CatalogListOutput> {
  return useQuery<CatalogListOutput>({
    queryKey: ['catalog', type, params] as const,
    queryFn: async () => {
      const result = await api.catalog.list({ type, ...params });
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
    ...options,
  });
}

/**
 * useContentById — fetches a single content item, or a series with seasons.
 * Query key: ['content', type, id]
 */
export function useContentById(
  type: CatalogType,
  id: number | null,
  options?: Partial<UseQueryOptions<CatalogItem | SeriesDetail>>,
): UseQueryResult<CatalogItem | SeriesDetail> {
  return useQuery<CatalogItem | SeriesDetail>({
    queryKey: ['content', type, id] as const,
    queryFn: async () => {
      if (id == null) throw new Error('Content ID required');
      const input: CatalogGetByIdInput = { type, id };
      const result = await api.catalog.getById(input);
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
    enabled: id != null,
    ...options,
  });
}

/**
 * useCatalogGroups — fetches distinct group_title values for a catalog type.
 * Query key: ['catalog-groups', type]
 */
export function useCatalogGroups(
  type: CatalogType,
  options?: Partial<UseQueryOptions<string[]>>,
): UseQueryResult<string[]> {
  return useQuery<string[]>({
    queryKey: ['catalog-groups', type] as const,
    queryFn: async () => {
      const result = await api.catalog.groups({ type });
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
    ...options,
  });
}
