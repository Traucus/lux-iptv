import type { EnrichmentStatus } from '../../shared/types/ipc';

let worker: Worker | null = null;
let isRunning = false;
let queueLength = 0;
let lastEnrichedAt: number | null = null;

type StatusListener = (status: EnrichmentStatus) => void;
const statusListeners: Set<StatusListener> = new Set();

function notifyStatus(): void {
  const status: EnrichmentStatus = {
    queueLength,
    lastEnrichedAt,
    isRunning,
  };
  for (const listener of statusListeners) {
    listener(status);
  }
}

/**
 * Starts the enrichment worker with the given TMDB API key.
 */
export function startEnrichment(tmdbKey: string): void {
  if (worker) {
    // Worker already running
    return;
  }

  worker = new Worker(new URL('../workers/enrichment.worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data;

    switch (msg.type) {
      case 'STARTED':
        isRunning = true;
        notifyStatus();
        break;
      case 'PAUSED':
        isRunning = false;
        notifyStatus();
        break;
      case 'RESUMED':
        isRunning = true;
        notifyStatus();
        break;
      case 'ITEM_DONE':
        queueLength = Math.max(0, queueLength - 1);
        lastEnrichedAt = Date.now();
        notifyStatus();
        break;
      case 'ERROR':
        console.error('Enrichment worker error:', msg.message);
        break;
    }
  });

  worker.addEventListener('error', (event) => {
    console.error('Enrichment worker error:', event.message);
    isRunning = false;
    notifyStatus();
  });

  // Send START message
  worker.postMessage({ type: 'START', tmdbKey });
}

/**
 * Pauses the enrichment worker.
 */
export function pauseEnrichment(): void {
  if (worker) {
    worker.postMessage({ type: 'PAUSE' });
  }
}

/**
 * Resumes the enrichment worker.
 */
export function resumeEnrichment(): void {
  if (worker) {
    worker.postMessage({ type: 'RESUME' });
  }
}

/**
 * Sends items to the enrichment worker for processing.
 */
export function enqueueItems(items: Array<{ contentId: string; name: string; type: 'movie' | 'tv' | 'live'; year?: number | null }>): void {
  if (!worker) {
    console.warn('Enrichment worker not started');
    return;
  }
  queueLength += items.length;
  notifyStatus();
  worker.postMessage({ type: 'ENRICH_ITEMS', items });
}

/**
 * Gets the current enrichment status.
 */
export function getStatus(): EnrichmentStatus {
  return {
    queueLength,
    lastEnrichedAt,
    isRunning,
  };
}

/**
 * Subscribes to status changes.
 */
export function onStatusChange(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * Stops the enrichment worker.
 */
export function stopEnrichment(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    isRunning = false;
    queueLength = 0;
    notifyStatus();
  }
}
