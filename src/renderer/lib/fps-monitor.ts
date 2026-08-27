/**
 * FPS Monitor — Tracks rendering performance during playback.
 *
 * Design §7.11: requestAnimationFrame loop with 60-frame rolling average.
 * Logs console.warn if average FPS drops below 55 for 2+ seconds.
 */

const SAMPLE_COUNT = 60;
const FPS_THRESHOLD = 55;
const WARNING_DURATION_MS = 2000;

let frameTimes: number[] = [];
let lastFrameTime = 0;
let animationFrameId: number | null = null;
let isMonitoring = false;
let belowThresholdStart: number | null = null;
let warningLogged = false;

/**
 * Starts the FPS monitoring loop.
 * Call when playback begins.
 */
export function startFPSMonitor(): void {
  if (isMonitoring) return;
  
  isMonitoring = true;
  frameTimes = [];
  lastFrameTime = performance.now();
  belowThresholdStart = null;
  warningLogged = false;
  
  function tick(now: number): void {
    if (!isMonitoring) return;
    
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    
    // Ignore first frame (no delta yet)
    if (delta > 0) {
      frameTimes.push(delta);
      if (frameTimes.length > SAMPLE_COUNT) {
        frameTimes.shift();
      }
      
      // Calculate average FPS from frame times
      if (frameTimes.length >= 10) { // Need at least 10 samples
        const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const avgFPS = 1000 / avgFrameTime;
        
        if (avgFPS < FPS_THRESHOLD) {
          if (belowThresholdStart === null) {
            belowThresholdStart = now;
          } else if (!warningLogged && now - belowThresholdStart >= WARNING_DURATION_MS) {
            console.warn(`[perf] FPS drop: ${avgFPS.toFixed(1)} (avg over ${frameTimes.length} frames)`);
            warningLogged = true;
          }
        } else {
          belowThresholdStart = null;
          warningLogged = false;
        }
      }
    }
    
    animationFrameId = requestAnimationFrame(tick);
  }
  
  animationFrameId = requestAnimationFrame(tick);
}

/**
 * Stops the FPS monitoring loop.
 * Call when playback ends or pauses.
 */
export function stopFPSMonitor(): void {
  isMonitoring = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  frameTimes = [];
  belowThresholdStart = null;
  warningLogged = false;
}

/**
 * Gets the current average FPS (or null if not enough samples).
 */
export function getCurrentFPS(): number | null {
  if (frameTimes.length < 10) return null;
  const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  return 1000 / avgFrameTime;
}

/**
 * Gets the current frame time samples count.
 */
export function getSampleCount(): number {
  return frameTimes.length;
}

/**
 * Resets the monitor state without stopping.
 * Useful when seeking or changing sources.
 */
export function resetFPSMonitor(): void {
  frameTimes = [];
  lastFrameTime = performance.now();
  belowThresholdStart = null;
  warningLogged = false;
}