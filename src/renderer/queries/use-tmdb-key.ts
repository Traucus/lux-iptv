import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { createLuxAPI } from '../lib/api';
import type { TmdbKeyInput } from '../../shared/types/ipc';

const api = createLuxAPI();

/**
 * useTmdbKey — checks if a TMDB API key is configured.
 */
export function useTmdbKey(): UseQueryResult<boolean> {
  return useQuery<boolean>({
    queryKey: ['tmdb', 'hasKey'] as const,
    queryFn: async () => {
      const result = await api.tmdb.hasKey();
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
  });
}

/**
 * useSetTmdbKey — validates and persists a TMDB API key.
 */
export function useSetTmdbKey(): UseMutationResult<{ valid: boolean }, Error, TmdbKeyInput> {
  const qc = useQueryClient();
  return useMutation<{ valid: boolean }, Error, TmdbKeyInput>({
    mutationFn: async (input: TmdbKeyInput) => {
      const result = await api.tmdb.setKey(input);
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
    onSuccess: (data) => {
      if (data.valid) {
        qc.setQueryData(['tmdb', 'hasKey'], true);
      }
    },
  });
}

/**
 * useClearTmdbKey — removes the stored TMDB API key.
 */
export function useClearTmdbKey(): UseMutationResult<void, Error, void> {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const result = await api.tmdb.clearKey();
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
    },
    onSuccess: () => {
      qc.setQueryData(['tmdb', 'hasKey'], false);
    },
  });
}
