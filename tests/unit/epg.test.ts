import { describe, it, expect } from 'vitest';
import { decodeEpgField, parseXtreamShortEpg, pickNowNext } from '../../src/main/services/epg';

describe('EPG parse and now/next', () => {
  it('decodes base64 Xtream titles', () => {
    expect(decodeEpgField(Buffer.from('News at 9').toString('base64'))).toBe('News at 9');
    expect(decodeEpgField('Already plain')).toBe('Already plain');
  });

  it('parses short EPG listings and picks now/next', () => {
    const now = 1_700_000_000_000;
    const programmes = parseXtreamShortEpg({
      epg_listings: [
        {
          title: Buffer.from('Breakfast').toString('base64'),
          start_timestamp: (now - 3_600_000) / 1000,
          stop_timestamp: (now - 60_000) / 1000,
        },
        {
          title: Buffer.from('News').toString('base64'),
          start_timestamp: now / 1000,
          stop_timestamp: (now + 1_800_000) / 1000,
        },
        {
          title: Buffer.from('Weather').toString('base64'),
          start_timestamp: (now + 1_800_000) / 1000,
          stop_timestamp: (now + 3_600_000) / 1000,
        },
      ],
    });
    expect(programmes).toHaveLength(3);
    const picked = pickNowNext(programmes, now);
    expect(picked.now?.title).toBe('News');
    expect(picked.next?.title).toBe('Weather');
  });
});
