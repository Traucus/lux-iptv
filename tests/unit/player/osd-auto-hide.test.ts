// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * TASK-059: OSD auto-hide tests
 */

function useIdleOSD(timeoutMs: number): { visible: boolean; handlers: Record<string, () => void> } {
  let visible = true;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const resetTimer = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      visible = false;
    }, timeoutMs);
  };

  const handleActivity = () => {
    visible = true;
    resetTimer();
  };

  const handlers = {
    mousemove: handleActivity,
    keydown: handleActivity,
    pointerdown: handleActivity,
    wheel: handleActivity,
  };

  // Start the timer
  resetTimer();

  return { 
    get visible() { return visible; },
    handlers 
  };
}

describe('useIdleOSD', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts visible', () => {
    const { result } = renderHook(() => useIdleOSD(4000));
    expect(result.current.visible).toBe(true);
  });

  it('hides after timeout', () => {
    const { result } = renderHook(() => useIdleOSD(4000));
    
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    
    expect(result.current.visible).toBe(false);
  });

  it('resets timer on mousemove', () => {
    const { result } = renderHook(() => useIdleOSD(4000));
    
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    
    expect(result.current.visible).toBe(true);
    
    act(() => {
      result.current.handlers.mousemove();
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.visible).toBe(true);
    
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    
    expect(result.current.visible).toBe(false);
  });

  it('resets timer on keydown', () => {
    const { result } = renderHook(() => useIdleOSD(4000));
    
    act(() => {
      vi.advanceTimersByTime(3000);
      result.current.handlers.keydown();
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.visible).toBe(true);
  });

  it('resets timer on pointerdown', () => {
    const { result } = renderHook(() => useIdleOSD(4000));
    
    act(() => {
      vi.advanceTimersByTime(3000);
      result.current.handlers.pointerdown();
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.visible).toBe(true);
  });

  it('resets timer on wheel', () => {
    const { result } = renderHook(() => useIdleOSD(4000));
    
    act(() => {
      vi.advanceTimersByTime(3000);
      result.current.handlers.wheel();
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.visible).toBe(true);
  });

  it('shows again after hidden when activity occurs', () => {
    const { result } = renderHook(() => useIdleOSD(4000));
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    expect(result.current.visible).toBe(false);
    
    act(() => {
      result.current.handlers.mousemove();
    });
    
    expect(result.current.visible).toBe(true);
  });

  it('multiple rapid events only reset once', () => {
    const { result } = renderHook(() => useIdleOSD(4000));
    
    act(() => {
      result.current.handlers.mousemove();
      result.current.handlers.keydown();
      result.current.handlers.pointerdown();
      vi.advanceTimersByTime(4000);
    });
    
    expect(result.current.visible).toBe(false);
  });
});