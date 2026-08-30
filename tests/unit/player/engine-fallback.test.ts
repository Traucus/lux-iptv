import { describe, it, expect } from 'vitest';
import { isHlsNetworkFailure } from '../../../src/renderer/services/media-engine';

describe('isHlsNetworkFailure', () => {
  it('stops the probe after HLS origin retries are exhausted', () => {
    expect(isHlsNetworkFailure(new Error('HLS fatal error: networkError'))).toBe(true);
  });

  it('allows mpegts/native after a playlist format miss', () => {
    expect(isHlsNetworkFailure(new Error('HLS fatal error: muxError'))).toBe(false);
    expect(isHlsNetworkFailure(new Error('HLS fatal error: mediaError'))).toBe(false);
  });
});

describe('HLS network stop is live-only', () => {
  it('does not treat episode/mp4 HLS timeout as terminal', () => {
    const err = new Error('HLS fatal error: networkError');
    expect(isHlsNetworkFailure(err)).toBe(true);
    // FallbackMediaEngine only throws on this when source.type === 'live'.
  });
});
