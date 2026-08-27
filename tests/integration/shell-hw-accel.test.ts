import { describe, it, expect } from 'vitest';
import {
  shouldDisableHwAccel,
  readHwAccelOverride,
} from '../../src/main/config/hw-accel';

/**
 * HW-acceleration policy tests. The production code in `src/main/index.ts`
 * applies the decision via `app.disableHardwareAcceleration()` before
 * `app.whenReady()` resolves — that side effect is not exercised here
 * (no Electron runtime in vitest), but the *policy* is the actual
 * production logic, not a duplicate.
 */
describe('shouldDisableHwAccel (policy)', () => {
  it('disables on Linux when LUX_HW_ACCEL is not set', () => {
    expect(shouldDisableHwAccel('linux', undefined)).toBe(true);
  });

  it('disables on Linux when LUX_HW_ACCEL is empty', () => {
    expect(shouldDisableHwAccel('linux', '')).toBe(true);
  });

  it('disables on Linux when LUX_HW_ACCEL is "false"', () => {
    expect(shouldDisableHwAccel('linux', 'false')).toBe(true);
  });

  it('disables on Linux when LUX_HW_ACCEL is "FALSE" (case-insensitive)', () => {
    expect(shouldDisableHwAccel('linux', 'FALSE')).toBe(true);
  });

  it('keeps enabled on Linux when LUX_HW_ACCEL=true', () => {
    expect(shouldDisableHwAccel('linux', 'true')).toBe(false);
  });

  it('keeps enabled on Linux when LUX_HW_ACCEL=TRUE (case-insensitive)', () => {
    expect(shouldDisableHwAccel('linux', 'TRUE')).toBe(false);
  });

  it('keeps enabled on Linux when LUX_HW_ACCEL=True', () => {
    expect(shouldDisableHwAccel('linux', 'True')).toBe(false);
  });

  it('keeps enabled on macOS regardless of override', () => {
    expect(shouldDisableHwAccel('darwin', undefined)).toBe(false);
    expect(shouldDisableHwAccel('darwin', 'false')).toBe(false);
  });

  it('keeps enabled on Windows regardless of override', () => {
    expect(shouldDisableHwAccel('win32', undefined)).toBe(false);
    expect(shouldDisableHwAccel('win32', 'false')).toBe(false);
  });
});

describe('readHwAccelOverride (reads process.env)', () => {
  it('returns shouldDisable=true on Linux without override', () => {
    expect(readHwAccelOverride({}).shouldDisable).toBe(process.platform === 'linux');
  });

  it('honors an explicit LUX_HW_ACCEL=true in the provided env', () => {
    const decision = readHwAccelOverride({ LUX_HW_ACCEL: 'true' });
    expect(decision.override).toBe('true');
    expect(decision.shouldDisable).toBe(false);
  });
});
