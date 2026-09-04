import { test, expect } from '@playwright/test';

/**
 * Slice 1: mkv play in the Lux window via in-process libmpv.
 * Skip the real-DLL path when LUX_LIBMPV_DIR is unset (CI / Linux apply).
 */

const hasLibmpvDll = Boolean(process.env.LUX_LIBMPV_DIR);

test.describe('Player Playback', () => {
  test('mkv in Lux window via in-process libmpv (skip without DLL)', async ({ page }) => {
    test.skip(!hasLibmpvDll, 'libmpv DLL not available in this environment');

    await page.goto('#/watch/movie/1');
    await expect(page.getByTestId('libmpv-surface')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.getByTestId('libmpv-diagnosis')).toHaveCount(0);
  });

  test('missing libmpv shows diagnosis and does not attach a Chromium video engine', async ({ page }) => {
    test.skip(hasLibmpvDll, 'DLL present — diagnosis path is covered by the mkv play test');

    await page.goto('#/watch/movie/1');
    await expect(page.getByTestId('libmpv-diagnosis').or(page.getByTestId('player-error'))).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('video')).toHaveCount(0);
  });
});
