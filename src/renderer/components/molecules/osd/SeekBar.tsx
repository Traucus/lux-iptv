import React, { useRef, useCallback, useEffect, useState } from 'react';

/**
 * SeekBar — Interactive seek/progress bar with pointer drag, D-Pad navigation,
 * and buffered range visualization.
 *
 * Design §7.4:
 * - Pointer drag seeks to clicked/dragged position
 * - D-Pad Left/Right: ±10s (configurable)
 * - Buffered range indicator
 * - Accessibility: role="slider" with aria attributes
 */

export interface SeekBarProps {
  /** Current playback time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Buffered time ranges (from video.buffered) */
  buffered: Array<{ start: number; end: number }>;
  /** Called when user seeks to a new position */
  onSeek: (time: number) => void;
  /** Optional D-Pad seek offset in seconds (default: 10) */
  seekOffset?: number;
  /** Disable interaction (e.g., for live TV) */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

export const SeekBar: React.FC<SeekBarProps> = ({
  currentTime,
  duration,
  buffered,
  onSeek,
  seekOffset = 10,
  disabled = false,
  className = '',
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayProgress = isDragging && hoverPosition !== null
    ? hoverPosition
    : progress;

  // Buffered ranges as percentages
  const bufferedRanges = React.useMemo(() => {
    return buffered.map((range) => ({
      start: duration > 0 ? (range.start / duration) * 100 : 0,
      end: duration > 0 ? (range.end / duration) * 100 : 0,
    }));
  }, [buffered, duration]);

  // Pointer event handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      updateSeekFromEvent(e);
    },
    [disabled, duration, onSeek]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || disabled) return;
      updateSeekFromEvent(e);
    },
    [isDragging, disabled, duration, onSeek]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      setHoverPosition(null);
    },
    [isDragging]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging) {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setIsDragging(false);
        setHoverPosition(null);
      }
    },
    [isDragging]
  );

  const updateSeekFromEvent = useCallback(
    (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width === 0) return;

      const clientX = 'clientX' in e ? e.clientX : e.nativeEvent.clientX;
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const seekTime = percent * duration;
      
      if (isDragging) {
        setHoverPosition(percent * 100);
      }
      
      onSeek(seekTime);
    },
    [duration, onSeek, isDragging]
  );

  // Keyboard (D-Pad) navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSeek(Math.min(currentTime + seekOffset, duration));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSeek(Math.max(currentTime - seekOffset, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        onSeek(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        onSeek(duration);
      }
    },
    [disabled, currentTime, duration, seekOffset, onSeek]
  );

  // Focus management for keyboard
  const handleFocus = useCallback(() => {
    if (!disabled && barRef.current) {
      barRef.current.focus();
    }
  }, [disabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (barRef.current) {
        try {
          barRef.current.releasePointerCapture(0);
        } catch {
          // Ignore if no pointer capture
        }
      }
    };
  }, []);

  if (duration <= 0) {
    return (
      <div
        ref={barRef}
        role="slider"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={0}
        aria-valuetext="0:00 / 0:00"
        tabIndex={disabled ? -1 : 0}
        className={`seek-bar ${className}`.trim()}
        style={{
          position: 'relative',
          width: '100%',
          height: '8px',
          background: '#333',
          borderRadius: '4px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        data-testid="seek-bar"
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: '0%',
            height: '100%',
            background: '#fff',
            borderRadius: '4px',
          }}
          data-testid="progress-fill"
        />
        <div
          style={{
            position: 'absolute',
            left: 'calc(0% - 6px)',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '12px',
            background: '#fff',
            borderRadius: '50%',
            opacity: disabled ? 0 : 1,
            transition: 'opacity 0.2s',
          }}
          data-testid="seek-thumb"
        />
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      role="slider"
      aria-valuenow={Math.round(currentTime)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
      tabIndex={disabled ? -1 : 0}
      className={`seek-bar ${className}`.trim()}
      style={{
        position: 'relative',
        width: '100%',
        height: '8px',
        background: '#333',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      data-testid="seek-bar"
    >
      {/* Buffered ranges */}
      {bufferedRanges.map((range, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${range.start}%`,
            width: `${Math.max(0, range.end - range.start)}%`,
            height: '100%',
            background: 'rgba(255,255,255,0.4)',
            borderRadius: '4px',
          }}
          data-testid="buffered-range"
        />
      ))}

      {/* Progress fill */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: `${displayProgress}%`,
          height: '100%',
          background: '#fff',
          borderRadius: '4px',
          transition: isDragging ? 'none' : 'width 0.1s linear',
        }}
        data-testid="progress-fill"
      />

      {/* Thumb */}
      <div
        style={{
          position: 'absolute',
          left: `calc(${displayProgress}% - 6px)`,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '12px',
          height: '12px',
          background: '#fff',
          borderRadius: '50%',
          opacity: disabled ? 0 : 1,
          transition: 'opacity 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
        data-testid="seek-thumb"
      />
    </div>
  );
};

/** Formats seconds as MM:SS or HH:MM:SS */
function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default SeekBar;