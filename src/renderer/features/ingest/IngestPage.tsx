import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CredentialsForm, type CredentialsFormValue, validateCredentials } from './CredentialsForm';
import { IngestOverlay } from './IngestOverlay';
import { SourceVaultCard } from './SourceVaultCard';
import { useStartIngest, useCancelIngest, useIngestProgress } from '../../queries/use-ingest';
import { useSourceSummary } from '../../queries/use-source';
import { createLuxAPI } from '../../lib/api';
import { Sidebar, type SidebarSection } from '../../components/organisms/Sidebar';
import type { CredentialSource } from '../../components/molecules/CredentialFormTabs';

const api = createLuxAPI();

const INITIAL_FORM: CredentialsFormValue = {
  source: 'm3u',
  server: '',
  username: '',
  password: '',
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
 * IngestPage — Screen 2 vault: configured card vs blank first-run/replace form.
 * Overlay stays page-local in this slice; first-run DONE navigates Home.
 */
export function IngestPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CredentialsFormValue>(INITIAL_FORM);
  const [replacing, setReplacing] = useState(false);
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
  const { data: summary } = useSourceSummary();

  const jobId = progress.jobId;
  const { data: progressData } = useIngestProgress(jobId);
  const showCard = Boolean(summary?.configured) && !replacing;

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

  // Persist after DONE. First-run navigates Home; replace stays on S2 and shows the card.
  useEffect(() => {
    if (progress.phase === 'DONE' && showOverlay) {
      api.config.saveCredentials({
        source: form.source,
        server: form.server,
        username: form.username,
        password: form.password,
        listName: form.listName,
        url: form.url,
      }).catch(() => { /* best-effort */ });
      const stayOnVault = replacing;
      const timer = window.setTimeout(() => {
        setShowOverlay(false);
        if (stayOnVault) {
          setReplacing(false);
          void queryClient.invalidateQueries({ queryKey: ['config'] });
        } else {
          navigate('/');
        }
      }, 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [progress.phase, showOverlay, navigate, form, replacing, queryClient]);

  const handleReplaceSource = (): void => {
    setReplacing(true);
    setForm(INITIAL_FORM);
  };

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

  const routeToSection = (pathname: string): SidebarSection => {
    if (pathname.startsWith('/live')) return 'live';
    if (pathname.startsWith('/movies')) return 'movies';
    if (pathname.startsWith('/series')) return 'series';
    if (pathname.startsWith('/ingest')) return 'settings';
    return 'home';
  };

  const activeSection = routeToSection(location.pathname);

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
      case 'settings':
        navigate('/ingest');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar active={activeSection} onSelect={onSidebarSelect} />

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl p-8 rounded-2xl glass-heavy shadow-glass-lg">
          {showCard ? (
            <SourceVaultCard
              listName={summary?.listName ?? 'Saved source'}
              source={summary?.source ?? 'xtream'}
              onReplace={handleReplaceSource}
            />
          ) : (
            <>
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
            </>
          )}
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
    </div>
  );
}

export default IngestPage;
