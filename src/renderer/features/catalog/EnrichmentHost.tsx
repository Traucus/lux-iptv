import { useEffect } from 'react';
import { createLuxAPI } from '../../lib/api';
import { useTmdbKey } from '../../queries/use-tmdb-key';
import { startEnrichment, stopEnrichment } from '../../services/enrichment-controller';

const api = createLuxAPI();

/**
 * Starts the TMDB enrichment worker when a key is saved. Play does not wait on this.
 */
export function EnrichmentHost(): null {
  const { data: hasKey } = useTmdbKey();

  useEffect(() => {
    if (!hasKey) {
      stopEnrichment();
      return;
    }

    let cancelled = false;
    void api.tmdb.getKey().then((result) => {
      if (cancelled || result.error || !result.data?.key) return;
      startEnrichment(result.data.key);
    });

    return () => {
      cancelled = true;
    };
  }, [hasKey]);

  return null;
}

export default EnrichmentHost;
