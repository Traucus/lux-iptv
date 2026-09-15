import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('Windows installer libmpv bundle (FA-13)', () => {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf8'),
  ) as {
    build?: {
      extraResources?: Array<{ from?: string; to?: string }>;
      files?: string[];
      win?: { target?: string };
    };
  };

  it('copies vendor/libmpv and lux-libmpv.node into extraResources, not git', () => {
    const resources = pkg.build?.extraResources ?? [];
    expect(resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'vendor/libmpv', to: 'libmpv' }),
        expect.objectContaining({
          from: 'native/lux-libmpv/build/Release/lux-libmpv.node',
          to: 'libmpv/lux-libmpv.node',
        }),
      ]),
    );
    expect(pkg.build?.files).toEqual(expect.arrayContaining(['dist/**/*']));
    expect(pkg.build?.files?.some((entry) => entry.includes('vendor/libmpv'))).toBe(false);
  });

  it('builds a Windows NSIS installer', () => {
    expect(pkg.build?.win?.target).toBe('nsis');
  });

  it('ignores vendor/libmpv so the DLL is not committed', () => {
    const gitignore = readFileSync(join(__dirname, '../../.gitignore'), 'utf8');
    expect(gitignore).toMatch(/vendor\/libmpv/);
  });
});
