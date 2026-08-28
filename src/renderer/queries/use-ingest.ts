import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { createLuxAPI } from '../lib/api';
import type { IngestProgress, IngestStartInput, IngestCancelInput } from '../../shared/types/ipc';

const api = createLuxAPI();

export interface IngestJobSnapshot {
  jobId: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  phase: string;
  percent: number;
  counts: { live: number; movies: number; series: number; radio: number; total: number };
  errorMessage?: string;
}

/**
 * useStartIngest — starts a new ingestion job with optimistic update on currentJob.
 */
export function useStartIngest(): UseMutationResult<
  { jobId: string },
  Error,
  IngestStartInput
> {
  const qc = useQueryClient();
  return useMutation<{ jobId: string }, Error, IngestStartInput, { previous: IngestJobSnapshot | null | undefined }>({
    mutationFn: async (input: IngestStartInput) => {
      const result = await api.ingest.start(input);
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
    onMutate: async () => {
      // Optimistic: mark a pending job
      await qc.cancelQueries({ queryKey: ['ingest', 'currentJob'] });
      const previous = qc.getQueryData<IngestJobSnapshot | null>(['ingest', 'currentJob']);
      const optimistic: IngestJobSnapshot = {
        jobId: 'pending',
        status: 'running',
        phase: 'FETCH',
        percent: 0,
        counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0 },
      };
      qc.setQueryData(['ingest', 'currentJob'], optimistic);
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(['ingest', 'currentJob'], context.previous);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData<IngestJobSnapshot>(['ingest', 'currentJob'], {
        jobId: data.jobId,
        status: 'running',
        phase: 'FETCH',
        percent: 0,
        counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0 },
      });
      // Invalidate catalog so the new content is fetched when ready
      void qc.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}

/**
 * useCancelIngest — cancels an active ingestion job.
 */
export function useCancelIngest(): UseMutationResult<void, Error, IngestCancelInput> {
  const qc = useQueryClient();
  return useMutation<void, Error, IngestCancelInput>({
    mutationFn: async (input: IngestCancelInput) => {
      const result = await api.ingest.cancel(input);
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
    },
    onSuccess: () => {
      qc.setQueryData<IngestJobSnapshot>(['ingest', 'currentJob'], (prev) =>
        prev ? { ...prev, status: 'cancelled' } : prev,
      );
    },
  });
}

/**
 * useIngestProgress — polls ingest progress every 500 ms while a job is active.
 */
export function useIngestProgress(
  jobId: string | null,
): UseQueryResult<IngestProgress> {
  return useQuery<IngestProgress>({
    queryKey: ['ingest', 'progress', jobId] as const,
    queryFn: async () => {
      if (!jobId) throw new Error('Job ID required');
      const result = await api.ingest.getProgress({ jobId });
      if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      return result.data;
    },
    enabled: jobId != null && jobId !== 'pending',
    refetchInterval: (query) => {
      // Stop polling once the job reaches a terminal phase
      const phase = query.state.data?.phase;
      if (phase === 'DONE' || phase === 'ERROR') return false;
      return 500;
    },
  });
}
