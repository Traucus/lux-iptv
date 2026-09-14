import { useEffect, useMemo } from 'react';
import { useEnrichmentBatch } from '../../queries/use-enrichment-data';
import { enrichItems, toContentId } from '../../lib/enrichment-merge';
import { enqueueItems } from '../../services/enrichment-controller';
import type { CatalogItem } from '../../../shared/types/ipc';
import type { MoviePosterData } from '../../components/molecules/MoviePosterCard';
import type { ContentEnrichmentRecord } from '../../db/schema';

export type PosterRowItem = {
  id: number;
  name: string;
  cover: string | null;
  year: number | null;
};

function toCatalogStub(item: PosterRowItem): CatalogItem {
  return {
    id: item.id,
    name: item.name,
    url: '',
    groupTitle: null,
    cover: item.cover,
    year: item.year,
    contentType: 'movie',
    mediaFormat: 'unknown',
    containerExtension: '',
    directSource: '',
    httpHeaders: {},
  };
}

export function useEnrichedPosters(
  items: readonly PosterRowItem[],
  mediaType: 'movie' | 'tv' | 'live',
): Map<number, MoviePosterData> {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const idKey = ids.join(',');
  const batch = useEnrichmentBatch(ids);

  useEffect(() => {
    if (mediaType === 'live' || items.length === 0) return;
    enqueueItems(
      items.map((item) => ({
        contentId: toContentId(item.id),
        name: item.name,
        type: mediaType,
        year: item.year,
      })),
    );
    // idKey captures item identity without re-enqueueing every render.
  }, [idKey, mediaType]);

  return useMemo(() => {
    const records = batch
      .map((result) => result.data)
      .filter((record): record is ContentEnrichmentRecord => record != null);
    const enriched = enrichItems(items.map(toCatalogStub), records, { fallbackToM3uCover: true });
    const map = new Map<number, MoviePosterData>();
    for (const item of enriched) {
      map.set(item.id, {
        id: item.id,
        name: item.name,
        year: item.year,
        posterPath: item.posterUrl ?? item.cover,
        enriched: item.enrichmentStatus === 'enriched',
      });
    }
    return map;
  }, [batch, items]);
}

export function posterFromRow(
  item: PosterRowItem,
  enriched: Map<number, MoviePosterData>,
): MoviePosterData {
  return (
    enriched.get(item.id) ?? {
      id: item.id,
      name: item.name,
      year: item.year,
      posterPath: item.cover,
      enriched: false,
    }
  );
}
