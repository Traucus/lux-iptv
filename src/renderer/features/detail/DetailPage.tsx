import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '../../components/atoms/Spinner';
import { Button } from '../../components/atoms/Button';
import { useContentById } from '../../queries/use-catalog';
import { useEnrichedContent } from './useEnrichedContent';
import { MovieDetail } from './MovieDetail';
import { SeriesDetailView } from './SeriesDetail';
import type { CatalogItem, CatalogType, SeriesDetail } from '../../../shared/types/ipc';

function isSeriesDetail(value: CatalogItem | SeriesDetail): value is SeriesDetail {
  return typeof (value as SeriesDetail).series !== 'undefined' && Array.isArray((value as SeriesDetail).seasons);
}

/**
 * DetailPage — Screen 4 detail view.
 * Routes /content/:id to either Movie or Series detail based on the type.
 * Loads IndexedDB enrichment so the synopsis, genres, backdrop, and rating
 * are displayed when available. Falls back to degraded mode otherwise.
 */
export function DetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const numericId = id ? Number(id) : NaN;

  // We need to figure out the type from the ID; the API requires both type + id.
  // Convention: IDs < 100_000_000 are movies, larger are series (very rough heuristic).
  // In a real implementation this would come from a separate "type lookup" call.
  const inferredType: CatalogType = !Number.isNaN(numericId) && numericId >= 1_000_000_000 ? 'series' : 'movie';

  const { data, isLoading, isError, error } = useContentById(inferredType, numericId);

  if (Number.isNaN(numericId)) {
    return <InvalidIdState onBack={() => navigate('/')} />;
  }
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner size="lg" label="Loading detail" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-red-400 text-lg">Failed to load content</p>
          <p className="text-gray-400 text-sm">{(error as Error)?.message ?? 'Unknown error'}</p>
          <Button onClick={() => navigate('/')} variant="glass">
            Back to Dashboard
          </Button>
        </div>
      </main>
    );
  }

  if (isSeriesDetail(data)) {
    return (
      <SeriesDetailPage data={data} onBack={() => navigate('/')} />
    );
  }

  return (
    <MovieDetailPage item={data as CatalogItem} onBack={() => navigate('/')} />
  );
}

function MovieDetailPage({ item, onBack }: { item: CatalogItem; onBack: () => void }): React.ReactElement {
  // The enrichment hook may return null while the IndexedDB read is still
  // pending. We only show a spinner for that brief moment; once the record
  // is available (or we know it doesn't exist) we render the detail view.
  const { enriched, isEnrichmentLoading } = useEnrichedContent(item, { optimisticFromStatus: true });
  if (!enriched) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner size="lg" label={isEnrichmentLoading ? 'Loading enrichment' : 'Loading detail'} />
      </div>
    );
  }
  return (
    <main className="min-h-screen bg-surface">
      <div className="px-4 py-2">
        <Button onClick={onBack} variant="glass" size="sm">
          ← Back
        </Button>
      </div>
      <MovieDetail
        item={enriched}
        onPlay={() => undefined}
        onAddToFavorites={() => undefined}
      />
    </main>
  );
}

function SeriesDetailPage({ data, onBack }: { data: SeriesDetail; onBack: () => void }): React.ReactElement {
  const { enriched, isEnrichmentLoading } = useEnrichedContent(data.series, { optimisticFromStatus: true });
  return (
    <main className="min-h-screen bg-surface">
      <div className="px-4 py-2">
        <Button onClick={onBack} variant="glass" size="sm">
          ← Back
        </Button>
      </div>
      {isEnrichmentLoading && !enriched ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Spinner size="lg" label="Loading enrichment" />
        </div>
      ) : (
        <SeriesDetailView
          series={data}
          enrichedSeries={enriched}
          onPlay={() => undefined}
          onAddToFavorites={() => undefined}
        />
      )}
    </main>
  );
}

function InvalidIdState({ onBack }: { onBack: () => void }): React.ReactElement {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-red-400 text-lg">Invalid content ID</p>
        <Button onClick={onBack} variant="glass">
          Back to Dashboard
        </Button>
      </div>
    </main>
  );
}

export default DetailPage;
