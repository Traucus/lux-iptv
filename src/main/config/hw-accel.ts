/**
 * Hardware-acceleration policy.
 *
 * On Linux, hardware acceleration is **disabled by default** because the
 * available GL drivers are inconsistent across distros and frequently cause
 * black-screen or segfault issues. Operators who need HW accel can opt
 * back in via the `LUX_HW_ACCEL=true` env var.
 *
 * On macOS and Windows the default is left alone — both platforms have
 * stable drivers and HW accel materially helps hls.js decode performance.
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
  if (platform !== 'linux') return false;
  return override?.toLowerCase() !== 'true';
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
