// @vitest-environment happy-dom
/**
 * FPS Monitor tests — verifies the 60-frame rolling average and warning logic.
 *
 * Design §7.11: requestAnimationFrame loop with 60-frame rolling average.
 * Logs console.warn if average FPS drops below 55 for 2+ seconds.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startFPSMonitor,
  stopFPSMonitor,
  getCurrentFPS,
  getSampleCount,
  resetFPSMonitor,
} from '../../../src/renderer/lib/fps-monitor';

// Mock requestAnimationFrame and performance.now
let frameCallback: ((now: number) => void) | null = null;
let mockTime = 1000;

vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
  frameCallback = cb;
  return 1;
});

vi.stubGlobal('cancelAnimationFrame', () => {
  frameCallback = null;
});

vi.stubGlobal('performance', {
  now: () => mockTime,
});

describe('FPS Monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTime = 1000;
    frameCallback = null;
    stopFPSMonitor();
  });

  afterEach(() => {
    stopFPSMonitor();
  });

  describe('startFPSMonitor', () => {
    it('starts monitoring and requests animation frame', () => {
      startFPSMonitor();
      expect(frameCallback).toBeDefined();
    });

    it('does not restart if already monitoring', () => {
      startFPSMonitor();
      const firstCallback = frameCallback;
      startFPSMonitor();
      expect(frameCallback).toBe(firstCallback);
    });
  });

  describe('stopFPSMonitor', () => {
    it('stops monitoring and clears callback', () => {
      startFPSMonitor();
      expect(frameCallback).toBeDefined();
      stopFPSMonitor();
      expect(frameCallback).toBeNull();
    });

    it('clears frame samples', () => {
      startFPSMonitor();
      // Simulate some frames
      mockTime = 1016; // ~60 FPS
      frameCallback?.(mockTime);
      expect(getSampleCount()).toBe(1);
      
      stopFPSMonitor();
      expect(getSampleCount()).toBe(0);
    });
  });

  describe('getCurrentFPS', () => {
    it('returns null when not enough samples', () => {
      startFPSMonitor();
      expect(getCurrentFPS()).toBeNull();
    });

    it('returns null with fewer than 10 samples', () => {
      startFPSMonitor();
      for (let i = 0; i < 9; i++) {
        mockTime += 16.67; // ~60 FPS
        frameCallback?.(mockTime);
      }
      expect(getCurrentFPS()).toBeNull();
    });

    it('returns FPS after 10 samples', () => {
      startFPSMonitor();
      // Simulate 10 frames at ~60 FPS (16.67ms each)
      for (let i = 0; i < 10; i++) {
        mockTime += 16.67;
        frameCallback?.(mockTime);
      }
      const fps = getCurrentFPS();
      expect(fps).not.toBeNull();
      expect(fps!).toBeGreaterThan(55);
      expect(fps!).toBeLessThan(65);
    });
  });

  describe('getSampleCount', () => {
    it('returns 0 when not monitoring', () => {
      expect(getSampleCount()).toBe(0);
    });

    it('returns frame count while monitoring', () => {
      startFPSMonitor();
      mockTime += 16.67;
      frameCallback?.(mockTime);
      expect(getSampleCount()).toBe(1);
      
      mockTime += 16.67;
      frameCallback?.(mockTime);
      expect(getSampleCount()).toBe(2);
    });
  });

  describe('resetFPSMonitor', () => {
    it('clears samples without stopping', () => {
      startFPSMonitor();
      mockTime += 16.67;
      frameCallback?.(mockTime);
      expect(getSampleCount()).toBe(1);
      
      resetFPSMonitor();
      expect(getSampleCount()).toBe(0);
      expect(frameCallback).toBeDefined(); // Still monitoring
    });
  });

  describe('FPS warning logic', () => {
    it('logs warning when FPS drops below 55 for 2+ seconds', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      startFPSMonitor();
      
      // Simulate 10 frames at 60 FPS first (to get enough samples)
      for (let i = 0; i < 10; i++) {
        mockTime += 16.67;
        frameCallback?.(mockTime);
      }
      
      // Now simulate slow frames (30 FPS = 33.33ms per frame)
      mockTime = 2000; // Start at 2 seconds
      for (let i = 0; i < 10; i++) {
        mockTime += 33.33;
        frameCallback?.(mockTime);
      }
      
      // Should not have warned yet (only ~0.33s at low FPS)
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      
      // Continue for 2+ seconds at low FPS
      for (let i = 0; i < 60; i++) {
        mockTime += 33.33;
        frameCallback?.(mockTime);
      }
      
      // Now should have warned
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[perf] FPS drop:')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('resets warning state when FPS recovers', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      startFPSMonitor();
      
      // Simulate 10 frames at 60 FPS
      for (let i = 0; i < 10; i++) {
        mockTime += 16.67;
        frameCallback?.(mockTime);
      }
      
      // Simulate slow frames for 1 second (not enough to warn)
      mockTime = 2000;
      for (let i = 0; i < 30; i++) {
        mockTime += 33.33;
        frameCallback?.(mockTime);
      }
      
      // Recover to 60 FPS
      for (let i = 0; i < 10; i++) {
        mockTime += 16.67;
        frameCallback?.(mockTime);
      }
      
      // Drop again for 2+ seconds
      mockTime = 3000;
      for (let i = 0; i < 120; i++) {
        mockTime += 33.33;
        frameCallback?.(mockTime);
      }
      
      // Should have warned (new low-FPS period)
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('rolling average', () => {
    it('maintains 60-frame rolling window', () => {
      startFPSMonitor();
      
      // Simulate 70 frames
      for (let i = 0; i < 70; i++) {
        mockTime += 16.67;
        frameCallback?.(mockTime);
      }
      
      // Should only keep 60 frames
      expect(getSampleCount()).toBe(60);
    });
  });
});
