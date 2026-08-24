export const RETRY_BACKOFF_MS = [1000, 2000, 4000] as const;
const JITTER_MAX_MS = 250;

type TaskFn = () => Promise<void>;

/**
 * Semaphore-based concurrency queue.
 * Limits the number of concurrent tasks to the specified concurrency level.
 */
export class SemaphoreQueue {
  private readonly concurrency: number;
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(concurrency: number = 5) {
    this.concurrency = concurrency;
  }

  /**
   * Enqueues a task. Runs immediately if under concurrency limit,
   * otherwise waits until a slot is available.
   */
  async enqueue(fn: TaskFn): Promise<void> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }

    this.active++;
    try {
      await fn();
    } finally {
      this.active--;
      const next = this.waiting.shift();
      if (next) next();
    }
  }

  /**
   * Calculates backoff delay for a given attempt number (0-indexed).
   * Includes random jitter to prevent thundering herd.
   */
  getBackoff(attempt: number): number {
    const base = RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
    const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
    return base + jitter;
  }
}
