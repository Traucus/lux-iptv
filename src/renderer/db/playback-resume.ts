import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Playback resume persistence using IndexedDB via idb library.
 *
 * Design §7.7: Minimal IndexedDB store for VOD resume positions.
 * Database: lux-playback; Store: positions (keyPath: 'id' = `${type}:${id}`)
 *
 * Write throttling: every 5s during playback + on pause/unmount.
 */

interface StoredPosition {
  id: string;           // `${type}:${id}` e.g. 'movie:42'
  position: number;     // Current playback position in seconds
  duration: number;     // Total duration in seconds
  updatedAt: number;    // Unix timestamp of last update
}

interface LuxPlaybackDB extends DBSchema {
  positions: {
    key: string;
    value: StoredPosition;
  };
}

const DB_NAME = 'lux-playback';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<LuxPlaybackDB> | null = null;

/**
 * Gets the IndexedDB instance, creating it if necessary.
 */
async function getDB(): Promise<IDBPDatabase<LuxPlaybackDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<LuxPlaybackDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('positions')) {
        db.createObjectStore('positions', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

/**
 * Generates the composite key for a position entry.
 */
function makeKey(type: string, id: number): string {
  return `${type}:${id}`;
}

/**
 * Gets the saved playback position for a content item.
 * @param type - Content type: 'movie' | 'episode'
 * @param id - Content ID
 * @returns StoredPosition or null if not found
 */
export async function getPosition(type: string, id: number): Promise<StoredPosition | null> {
  const db = await getDB();
  const key = makeKey(type, id);
  return (await db.get('positions', key)) ?? null;
}

/**
 * Sets the playback position for a content item.
 * @param type - Content type: 'movie' | 'episode'
 * @param id - Content ID
 * @param position - Current position in seconds
 * @param duration - Total duration in seconds
 */
export async function setPosition(type: string, id: number, position: number, duration: number): Promise<void> {
  const db = await getDB();
  const key = makeKey(type, id);
  await db.put('positions', {
    id: key,
    position,
    duration,
    updatedAt: Date.now(),
  });
}

/**
 * Clears the saved playback position for a content item.
 * @param type - Content type: 'movie' | 'episode'
 * @param id - Content ID
 */
export async function clearPosition(type: string, id: number): Promise<void> {
  const db = await getDB();
  const key = makeKey(type, id);
  await db.delete('positions', key);
}

/**
 * Throttled position writer.
 * Call repeatedly during playback (e.g., on timeupdate); writes at most once per 5s.
 * Call flush() on pause/unmount to persist the latest position immediately.
 */
export function createPositionThrottler() {
  let pendingWrite: { type: string; id: number; position: number; duration: number } | null = null;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  const THROTTLE_MS = 5000;

  /**
   * Schedules a throttled write.
   */
  function throttle(type: string, id: number, position: number, duration: number): void {
    pendingWrite = { type, id, position, duration };

    if (throttleTimer) return; // Already scheduled

    throttleTimer = setTimeout(async () => {
      throttleTimer = null;
      if (pendingWrite) {
        const { type, id, position, duration } = pendingWrite;
        pendingWrite = null;
        try {
          await setPosition(type, id, position, duration);
        } catch (err) {
          console.warn('[playback-resume] Throttled write failed:', err);
        }
      }
    }, THROTTLE_MS);
  }

  /**
   * Immediately writes any pending position (call on pause/unmount).
   */
  async function flush(): Promise<void> {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    if (pendingWrite) {
      const { type, id, position, duration } = pendingWrite;
      pendingWrite = null;
      try {
        await setPosition(type, id, position, duration);
      } catch (err) {
        console.warn('[playback-resume] Flush write failed:', err);
      }
    }
  }

  /**
   * Cancels any pending write without persisting.
   */
  function cancel(): void {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    pendingWrite = null;
  }

  return { throttle, flush, cancel };
}

export type PositionThrottler = ReturnType<typeof createPositionThrottler>;