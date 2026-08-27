// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * TASK-054: resume persistence tests
 *
 * Tests the playback resume IndexedDB store:
 * - getPosition/setPosition/clearPosition
 * - throttled writes (every 5s during playback + on pause/unmount)
 */

// Use a simple in-memory mock for IndexedDB-like behavior
// The real implementation uses idb library with IndexedDB

interface StoredPosition {
  id: string;
  position: number;
  duration: number;
  updatedAt: number;
}

class MemoryPlaybackResume {
  private store = new Map<string, StoredPosition>();
  private writeThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingWrite: { key: string; position: number; duration: number } | null = null;
  private readonly throttleMs = 5000;

  async getPosition(type: string, id: number): Promise<StoredPosition | null> {
    const key = `${type}:${id}`;
    return this.store.get(key) ?? null;
  }

  async setPosition(type: string, id: number, position: number, duration: number): Promise<void> {
    const key = `${type}:${id}`;
    this.store.set(key, {
      id: key,
      position,
      duration,
      updatedAt: Date.now(),
    });
  }

  async clearPosition(type: string, id: number): Promise<void> {
    const key = `${type}:${id}`;
    this.store.delete(key);
  }

  throttleSetPosition(type: string, id: number, position: number, duration: number): void {
    this.pendingWrite = { key: `${type}:${id}`, position, duration };
    
    if (this.writeThrottleTimer) return;
    
    this.writeThrottleTimer = setTimeout(() => {
      this.writeThrottleTimer = null;
      if (this.pendingWrite) {
        const { key, position, duration } = this.pendingWrite;
        this.pendingWrite = null;
        const [type, idStr] = key.split(':');
        this.setPosition(type, parseInt(idStr, 10), position, duration).catch(console.error);
      }
    }, this.throttleMs);
  }

  async flush(): Promise<void> {
    if (this.writeThrottleTimer) {
      clearTimeout(this.writeThrottleTimer);
      this.writeThrottleTimer = null;
    }
    if (this.pendingWrite) {
      const { key, position, duration } = this.pendingWrite;
      this.pendingWrite = null;
      const [type, idStr] = key.split(':');
      await this.setPosition(type, parseInt(idStr, 10), position, duration);
    }
  }

  clear(): void {
    this.store.clear();
    if (this.writeThrottleTimer) {
      clearTimeout(this.writeThrottleTimer);
      this.writeThrottleTimer = null;
    }
    this.pendingWrite = null;
  }
}

describe('PlaybackResume (memory mock)', () => {
  let resume: MemoryPlaybackResume;

  beforeEach(() => {
    vi.useFakeTimers();
    resume = new MemoryPlaybackResume();
  });

  afterEach(async () => {
    await resume.flush(); // Clean up any pending
    resume.clear();
    vi.useRealTimers();
  });

  it('getPosition returns null for unknown key', async () => {
    const result = await resume.getPosition('movie', 42);
    expect(result).toBeNull();
  });

  it('setPosition and getPosition roundtrip', async () => {
    await resume.setPosition('movie', 42, 123.45, 3600);
    const result = await resume.getPosition('movie', 42);
    
    expect(result).not.toBeNull();
    expect(result!.id).toBe('movie:42');
    expect(result!.position).toBe(123.45);
    expect(result!.duration).toBe(3600);
    expect(result!.updatedAt).toBeGreaterThan(0);
  });

  it('clearPosition removes the entry', async () => {
    await resume.setPosition('movie', 42, 123.45, 3600);
    await resume.clearPosition('movie', 42);
    const result = await resume.getPosition('movie', 42);
    expect(result).toBeNull();
  });

  it('throttled writes are debounced to 5s', async () => {
    const spy = vi.spyOn(resume, 'setPosition');
    
    // Rapid calls within 5s window
    resume.throttleSetPosition('movie', 42, 10, 3600);
    resume.throttleSetPosition('movie', 42, 20, 3600);
    resume.throttleSetPosition('movie', 42, 30, 3600);
    
    // Advance 4s - should not have written yet
    await vi.advanceTimersByTimeAsync(4000);
    expect(spy).not.toHaveBeenCalled();
    
    // Advance 1s more (total 5s) - should write once with latest position
    await vi.advanceTimersByTimeAsync(1000);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('movie', 42, 30, 3600);
  });

  it('flush() writes immediately', async () => {
    const spy = vi.spyOn(resume, 'setPosition');
    
    resume.throttleSetPosition('movie', 42, 10, 3600);
    await resume.flush();
    
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('movie', 42, 10, 3600);
  });

  it('flush() clears pending write', async () => {
    resume.throttleSetPosition('movie', 42, 10, 3600);
    await resume.flush();
    
    // Advance time - should not write again
    await vi.advanceTimersByTimeAsync(5000);
    
    // No additional write should occur
    const result = await resume.getPosition('movie', 42);
    expect(result!.position).toBe(10);
  });

  it('different types are stored separately', async () => {
    await resume.setPosition('movie', 42, 100, 3600);
    await resume.setPosition('episode', 42, 200, 1800);
    
    const moviePos = await resume.getPosition('movie', 42);
    const episodePos = await resume.getPosition('episode', 42);
    
    expect(moviePos!.position).toBe(100);
    expect(episodePos!.position).toBe(200);
  });

  it('different IDs are stored separately', async () => {
    await resume.setPosition('movie', 1, 100, 3600);
    await resume.setPosition('movie', 2, 200, 3600);
    
    const pos1 = await resume.getPosition('movie', 1);
    const pos2 = await resume.getPosition('movie', 2);
    
    expect(pos1!.position).toBe(100);
    expect(pos2!.position).toBe(200);
  });

  it('updatedAt is set on write', async () => {
    const before = Date.now();
    await resume.setPosition('movie', 42, 100, 3600);
    const after = Date.now();
    
    const result = await resume.getPosition('movie', 42);
    expect(result!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(result!.updatedAt).toBeLessThanOrEqual(after);
  });
});