import { describe, it, expect } from 'vitest';
import { isHlsNetworkFailure, probeOrder } from '../../../src/renderer/services/media-engine';

describe('isHlsNetworkFailure', () => {
  it('stops the probe after HLS origin retries are exhausted', () => {
    expect(isHlsNetworkFailure(new Error('HLS fatal error: networkError'))).toBe(true);
  });

  it('allows mpegts/native after a playlist format miss', () => {
    expect(isHlsNetworkFailure(new Error('HLS fatal error: muxError'))).toBe(false);
    expect(isHlsNetworkFailure(new Error('HLS fatal error: mediaError'))).toBe(false);
  });
});

describe('probeOrder', () => {
  it('does not put mpegts on mp4 or hls VOD', () => {
    expect(probeOrder('episode', 'mp4')).toEqual(['native', 'hls']);
    expect(probeOrder('movie', 'hls')).toEqual(['hls', 'native']);
  });

  it('keeps mpegts for live and ts only', () => {
    expect(probeOrder('live', 'hls')).toEqual(['hls', 'mpegts', 'native']);
    expect(probeOrder('episode', 'ts')).toEqual(['mpegts', 'hls', 'native']);
  });
});
