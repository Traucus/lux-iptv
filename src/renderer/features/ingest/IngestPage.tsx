import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CredentialsForm, type CredentialsFormValue, validateCredentials } from './CredentialsForm';
import { IngestOverlay } from './IngestOverlay';
import { useStartIngest, useCancelIngest, useIngestProgress } from '../../queries/use-ingest';
import { createLuxAPI } from '../../lib/api';
import type { CredentialSource } from '../../components/molecules/CredentialFormTabs';

const api = createLuxAPI();

const INITIAL_FORM: CredentialsFormValue = {
  source: 'm3u',
  url: '',
  listName: '',
};

interface ProgressState {
  phase: 'FETCH' | 'FETCH_LIVE' | 'FETCH_VOD' | 'FETCH_SERIES' | 'ITEMS' | 'CLASSIFY' | 'PERSIST' | 'DONE' | 'ERROR' | null;
  percent: number;
  counts: { live: number; movies: number; series: number; radio: number; total: number };
  errorMessage: string | null;
  jobId: string | null;
}

const ZERO_COUNTS = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };

/**
 * IngestPage — Screen 2 onboarding flow.
 * Tab switch Xtream/M3U, URL validation, IngestOverlay on start, auto-transition to dashboard on DONE.
 */
export function IngestPage(): React.ReactElement {
  const navigate = useNavigate();
  const [form, setForm] = useState<CredentialsFormValue>(INITIAL_FORM);
  const [progress, setProgress] = useState<ProgressState>({
    phase: null,
    percent: 0,
    counts: ZERO_COUNTS,
    errorMessage: null,
    jobId: null,
  });
  const [showOverlay, setShowOverlay] = useState(false);

  const startIngest = useStartIngest();
  const cancelIngest = useCancelIngest();

  const jobId = progress.jobId;
  const { data: progressData } = useIngestProgress(jobId);

  // Listen for IPC progress events to keep the overlay in sync.
  // The orchestrator sends flat { phase, live, movies, series, radio, total }
  // — we reconstruct the counts object here.
  useEffect(() => {
    const unsubscribe = api.ingest.onProgress((p: Record<string, unknown>) => {
      setProgress((prev) => ({
        ...prev,
        phase: (p.phase as ProgressState['phase']) ?? prev.phase,
        percent: (p.percent as number) ?? prev.percent,
        counts: {
          live: (p.live as number) ?? prev.counts.live,
          movies: (p.movies as number) ?? prev.counts.movies,
          series: (p.series as number) ?? prev.counts.series,
          radio: (p.radio as number) ?? prev.counts.radio,
          total: (p.total as number) ?? prev.counts.total,
        },
      }));
    });
    return unsubscribe;
  }, []);

  // Forward polled progress into local state.
  useEffect(() => {
    if (!progressData) return;
    setProgress((prev) => ({
      ...prev,
      phase: (progressData.phase as ProgressState['phase']) ?? prev.phase,
      percent: progressData.percent,
      counts: progressData.counts,
    }));
  }, [progressData]);

  // On mutation success, mark jobId + show overlay.
  useEffect(() => {
    if (startIngest.data?.jobId) {
      setProgress((prev) => ({ ...prev, jobId: startIngest.data!.jobId, phase: 'FETCH' }));
      setShowOverlay(true);
    }
  }, [startIngest.data]);

  // On mutation error, surface error in overlay.
  useEffect(() => {
    if (startIngest.error) {
      setProgress((prev) => ({
        ...prev,
        phase: 'ERROR',
        errorMessage: startIngest.error?.message ?? 'Ingestion failed',
      }));
      setShowOverlay(true);
    }
  }, [startIngest.error]);

  // Auto-transition to dashboard when DONE.
  useEffect(() => {
    if (progress.phase === 'DONE' && showOverlay) {
      const timer = window.setTimeout(() => {
        setShowOverlay(false);
        navigate('/');
      }, 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [progress.phase, showOverlay, navigate]);

  const handleSourceChange = (source: CredentialSource): void => {
    setForm((prev) => ({ ...prev, source }));
  };

  const handleSubmit = (): void => {
    const errors = validateCredentials(form);
    if (Object.keys(errors).length > 0) return;
    startIngest.mutate({
      source: form.source,
      listName: form.listName,
      credentials: form.source === 'xtream' && form.server && form.username && form.password
        ? { server: form.server, username: form.username, password: form.password }
        : undefined,
      url: form.source === 'm3u' ? form.url : undefined,
    });
  };

  const handleCancel = (): void => {
    if (progress.jobId) {
      cancelIngest.mutate({ jobId: progress.jobId });
    }
    setShowOverlay(false);
    setProgress({ phase: null, percent: 0, counts: ZERO_COUNTS, errorMessage: null, jobId: null });
  };

  const handleRetry = (): void => {
    setProgress({ phase: null, percent: 0, counts: ZERO_COUNTS, errorMessage: null, jobId: null });
    setShowOverlay(false);
  };

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl p-8 rounded-2xl glass-heavy shadow-glass-lg">
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-display-sm font-bold text-white">Add your IPTV source</h1>
          <p className="text-gray-400">
            Choose Xtream Codes API or paste an M3U playlist URL to get started.
          </p>
        </div>
        <CredentialsForm
          source={form.source}
          onSourceChange={handleSourceChange}
          value={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          submitting={startIngest.isPending}
        />
      </div>

      {showOverlay && progress.phase ? (
        <IngestOverlay
          phase={progress.phase}
          percent={progress.percent}
          counts={progress.counts}
          errorMessage={progress.errorMessage}
          onRetry={progress.phase === 'ERROR' ? handleRetry : undefined}
          onCancel={progress.phase !== 'ERROR' && progress.phase !== 'DONE' ? handleCancel : undefined}
        />
      ) : null}
    </main>
  );
}

export default IngestPage;
