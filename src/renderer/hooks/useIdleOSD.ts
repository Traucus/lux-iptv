import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useIdleOSD — Hook for auto-hiding OSD after a period of inactivity.
 *
 * Design §7.5:
 * - Listens for mousemove, keydown, pointerdown, wheel on document
 * - Resets timer on any activity
 * - Returns { visible: boolean }
 * - CSS handles the fade transition (opacity 0→1 in 200ms)
 */

export function useIdleOSD(timeoutMs: number = 4000): { visible: boolean } {
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMsRef = useRef(timeoutMs);

  // Update timeout ref when it changes
  useEffect(() => {
    timeoutMsRef.current = timeoutMs;
  }, [timeoutMs]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, timeoutMsRef.current);
  }, []);

  const handleActivity = useCallback(() => {
    setVisible(true);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    // Initial timer start
    resetTimer();

    // Activity events that reset the timer
    const events: Array<keyof DocumentEventMap> = [
      'mousemove',
      'keydown',
      'pointerdown',
      'wheel',
    ];

    const handlers = events.map((event) => ({
      event,
      handler: handleActivity as EventListener,
    }));

    handlers.forEach(({ event, handler }) => {
      document.addEventListener(event, handler, { passive: true });
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      handlers.forEach(({ event, handler }) => {
        document.removeEventListener(event, handler);
      });
    };
  }, [handleActivity, resetTimer]);

  return { visible };
}

export default useIdleOSD;