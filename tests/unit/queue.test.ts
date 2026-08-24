import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SemaphoreQueue, RETRY_BACKOFF_MS } from '../../src/renderer/services/queue';

describe('queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('SemaphoreQueue', () => {
    it('runs up to concurrency limit in parallel', async () => {
      const queue = new SemaphoreQueue(3);
      const running: number[] = [];
      const maxConcurrent = { value: 0 };

      const task = (id: number) => async () => {
        running.push(id);
        maxConcurrent.value = Math.max(maxConcurrent.value, running.length);
        await new Promise((resolve) => setTimeout(resolve, 100));
        running.splice(running.indexOf(id), 1);
      };

      const p1 = queue.enqueue(task(1));
      const p2 = queue.enqueue(task(2));
      const p3 = queue.enqueue(task(3));
      const p4 = queue.enqueue(task(4));
      const p5 = queue.enqueue(task(5));

      // Advance timers to let tasks complete
      await vi.advanceTimersByTimeAsync(50);
      expect(maxConcurrent.value).toBe(3);

      await vi.advanceTimersByTimeAsync(200);
      await Promise.all([p1, p2, p3, p4, p5]);
      expect(maxConcurrent.value).toBe(3);
    });

    it('respects concurrency of 5 (default)', async () => {
      const queue = new SemaphoreQueue(5);
      let active = 0;
      let maxActive = 0;

      const task = async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 50));
        active--;
      };

      const promises = Array.from({ length: 10 }, () => queue.enqueue(task));
      await vi.advanceTimersByTimeAsync(200);
      await Promise.all(promises);

      expect(maxActive).toBe(5);
    });

    it('6th task waits when 5 are running', async () => {
      const queue = new SemaphoreQueue(5);
      const started: number[] = [];

      const task = (id: number) => async () => {
        started.push(id);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      };

      // Enqueue 6 tasks
      const promises = Array.from({ length: 6 }, (_, i) => queue.enqueue(task(i)));

      // Advance a bit - only 5 should have started
      await vi.advanceTimersByTimeAsync(50);
      expect(started).toHaveLength(5);
      expect(started).toEqual([0, 1, 2, 3, 4]);

      // Complete one task
      await vi.advanceTimersByTimeAsync(1000);

      // Now the 6th should start
      await vi.advanceTimersByTimeAsync(50);
      expect(started).toHaveLength(6);

      await vi.advanceTimersByTimeAsync(1000);
      await Promise.all(promises);
    });
  });

  describe('RETRY_BACKOFF_MS', () => {
    it('has correct backoff values', () => {
      expect(RETRY_BACKOFF_MS).toEqual([1000, 2000, 4000]);
    });

    it('has 3 retry attempts', () => {
      expect(RETRY_BACKOFF_MS).toHaveLength(3);
    });
  });

  describe('backoff calculation', () => {
    it('calculates backoff with jitter', () => {
      const queue = new SemaphoreQueue(5);
      // Test the backoff method
      const b0 = queue.getBackoff(0);
      const b1 = queue.getBackoff(1);
      const b2 = queue.getBackoff(2);

      expect(b0).toBeGreaterThanOrEqual(1000);
      expect(b0).toBeLessThanOrEqual(1250);
      expect(b1).toBeGreaterThanOrEqual(2000);
      expect(b1).toBeLessThanOrEqual(2250);
      expect(b2).toBeGreaterThanOrEqual(4000);
      expect(b2).toBeLessThanOrEqual(4250);
    });
  });
});
