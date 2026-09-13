/**
 * Hardware-acceleration policy.
 *
 * Chromium GPU is **disabled by default** on Linux and Windows.
 * Linux: unstable GL drivers. Windows: the GPU compositor paints over the
 * libmpv child HWND (black surface). Decode is libmpv `hwdec=auto-safe`,
 * not Chromium. Opt back in with `LUX_HW_ACCEL=true`.
 *
 * The decision MUST be applied before `app.whenReady()` resolves.
 */

/**
 * Pure policy: should we disable HW accel for the given platform/override?
 * Exported separately from the side-effecting {@link applyHwAccelPolicy} so
 * tests can exercise the logic without an Electron runtime.
 */
export function shouldDisableHwAccel(
  platform: NodeJS.Platform,
  override: string | undefined,
): boolean {
  if (override?.toLowerCase() === 'true') return false;
  return platform === 'linux' || platform === 'win32';
}

/**
 * Reads the env-var override and returns whether HW accel should be
 * disabled. Pure function — no side effects, safe to call in tests.
 */
export function readHwAccelOverride(env: NodeJS.ProcessEnv = process.env): {
  platform: NodeJS.Platform;
  override: string | undefined;
  shouldDisable: boolean;
} {
  const platform = process.platform;
  const override = env.LUX_HW_ACCEL;
  return {
    platform,
    override,
    shouldDisable: shouldDisableHwAccel(platform, override),
  };
}
