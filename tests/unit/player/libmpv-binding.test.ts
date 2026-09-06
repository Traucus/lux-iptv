import { describe, it, expect, vi } from 'vitest';
import { createForwardingBinding, type NativeSession } from '../../../src/main/player/libmpv-binding';

function session(): NativeSession {
  return {
    play: vi.fn(),
    stop: vi.fn(),
    setOptions: vi.fn(),
    getTrackList: vi.fn(() => [{ id: 2, type: 'audio', title: 'Spanish' }]),
    setProperty: vi.fn(),
    getProperty: vi.fn(() => 42),
    command: vi.fn(),
  };
}

describe('createForwardingBinding', () => {
  it('forwards track-list, properties, and commands to the native session', () => {
    const native = session();
    const binding = createForwardingBinding(() => native);
    expect(binding.getTrackList?.()).toEqual([{ id: 2, type: 'audio', title: 'Spanish' }]);
    binding.setProperty?.('aid', 2);
    expect(native.setProperty).toHaveBeenCalledWith('aid', 2);
    expect(binding.getProperty?.('time-pos')).toBe(42);
    binding.command?.(['sub-add', 'movie.srt']);
    expect(native.command).toHaveBeenCalledWith(['sub-add', 'movie.srt']);
  });

  it('returns empty tracks when no session is loaded', () => {
    const binding = createForwardingBinding(() => null);
    expect(binding.getTrackList?.()).toEqual([]);
    expect(binding.getProperty?.('duration')).toBeUndefined();
  });
});
