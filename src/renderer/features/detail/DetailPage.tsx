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
 * Routes /content/:type/:id. Type must be movie or series — catalog ids are
 * per-table autoincrement and must never be used to guess content kind.
 */
export function DetailPage(): React.ReactElement {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const numericId = id ? Number(id) : NaN;
  const contentType: CatalogType | null =
    type === 'movie' || type === 'series' ? type : null;

  const { data, isLoading, isError, error } = useContentById(
    contentType ?? 'movie',
    contentType && !Number.isNaN(numericId) ? numericId : null,
  );

  if (!contentType || Number.isNaN(numericId)) {
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
      <SeriesDetailPage data={data} onBack={() => navigate('/')} navigate={navigate} />
    );
  }

  return (
    <MovieDetailPage item={data as CatalogItem} onBack={() => navigate('/')} navigate={navigate} />
  );
}

function MovieDetailPage({ item, onBack, navigate }: { item: CatalogItem; onBack: () => void; navigate: ReturnType<typeof useNavigate> }): React.ReactElement {
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
        onPlay={() => navigate(`/watch/movie/${item.id}`)}
        onAddToFavorites={() => undefined}
      />
    </main>
  );
}

function SeriesDetailPage({ data, onBack, navigate }: { data: SeriesDetail; onBack: () => void; navigate: ReturnType<typeof useNavigate> }): React.ReactElement {
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
          onPlay={() => navigate(`/watch/series/${data.series.id}`)}
          onSelectEpisode={(ep) => navigate(`/watch/episode/${ep.id}`)}
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
