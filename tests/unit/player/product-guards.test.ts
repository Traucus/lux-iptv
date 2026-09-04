// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluatePlayerProductGuards,
  parseGitPorcelainPaths,
} from '../../../src/shared/player-product-guards';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

describe('evaluatePlayerProductGuards', () => {
  it('accepts sandboxed preload compiled as CommonJS', () => {
    const result = evaluatePlayerProductGuards({
      preloadModule: 'CommonJS',
      sources: [],
      changedPaths: [],
    });
    expect(result.preloadCommonJs).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rejects ESNext preload module (sandbox would silently mock luxAPI)', () => {
    const result = evaluatePlayerProductGuards({
      preloadModule: 'ESNext',
      sources: [],
      changedPaths: [],
    });
    expect(result.preloadCommonJs).toBe(false);
    expect(result.violations).toContain('preload-not-commonjs');
  });

  it('flags a play-path file that runtime-imports media-engine', () => {
    const result = evaluatePlayerProductGuards({
      preloadModule: 'CommonJS',
      sources: [
        {
          path: 'src/renderer/components/organisms/VideoPlayer.tsx',
          text: `import { createMediaEngine } from '../../services/media-engine';\ncreateMediaEngine(video, source);\n`,
        },
      ],
      changedPaths: [],
    });
    expect(result.mediaEngineUnused).toBe(false);
    expect(result.noHlsProbeOnPlay).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining(['media-engine-used', 'hls-probe-on-play']));
  });

  it('allows the leftover media-engine module itself and type-free libmpv play sources', () => {
    const result = evaluatePlayerProductGuards({
      preloadModule: 'CommonJS',
      sources: [
        {
          path: 'src/renderer/services/media-engine.ts',
          text: `import Hls from 'hls.js';\nexport function createMediaEngine() {}\n`,
        },
        {
          path: 'src/renderer/features/player/PlayerPage.tsx',
          text: `await luxAPI.player.play({ type: 'movie', id: 1 });\n`,
        },
        {
          path: 'src/renderer/components/organisms/VideoPlayer.tsx',
          text: `export const VideoPlayer = () => <div data-testid="libmpv-surface" />;\n`,
        },
        {
          path: 'src/main/ipc/handlers/player.ts',
          text: `import { createLibmpvEngine } from '../../player/libmpv-engine.js';\n`,
        },
      ],
      changedPaths: [],
    });
    expect(result.mediaEngineUnused).toBe(true);
    expect(result.noHlsProbeOnPlay).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('flags SPEC-HEALTH added under src/ but not openspec planning docs', () => {
    const dirty = evaluatePlayerProductGuards({
      preloadModule: 'CommonJS',
      sources: [],
      changedPaths: ['src/SPEC-HEALTH.md', 'openspec/specs/SPEC-HEALTH.md', 'docs/planning/notes.md'],
    });
    expect(dirty.noSpecHealthInProduct).toBe(false);
    expect(dirty.specHits).toEqual(['src/SPEC-HEALTH.md']);
    expect(dirty.violations).toContain('spec-health-in-product');

    const planningOnly = evaluatePlayerProductGuards({
      preloadModule: 'CommonJS',
      sources: [],
      changedPaths: ['openspec/specs/SPEC-HEALTH.md', 'docs/planning/SPEC-HEALTH.md'],
    });
    expect(planningOnly.noSpecHealthInProduct).toBe(true);
    expect(planningOnly.specHits).toEqual([]);
  });
});

describe('parseGitPorcelainPaths', () => {
  it('reads modified, untracked, and renamed paths from git porcelain', () => {
    expect(
      parseGitPorcelainPaths(
        [
          ' M src/preload/index.ts',
          '?? openspec/specs/SPEC-HEALTH.md',
          'R  docs/old.md -> src/SPEC-HEALTH.md',
        ].join('\n'),
      ),
    ).toEqual([
      'src/preload/index.ts',
      'openspec/specs/SPEC-HEALTH.md',
      'src/SPEC-HEALTH.md',
    ]);
  });
});

describe('workspace player product invariants', () => {
  it('keeps tsconfig.preload.json on CommonJS, play path off Chromium, and no SPEC-HEALTH in product files', () => {
    const preload = JSON.parse(
      readFileSync(path.join(repoRoot, 'tsconfig.preload.json'), 'utf8'),
    ) as { compilerOptions: { module: string } };

    const playPaths = [
      'src/renderer/features/player/PlayerPage.tsx',
      'src/renderer/components/organisms/VideoPlayer.tsx',
      'src/main/ipc/handlers/player.ts',
    ];
    const sources = playPaths.map((rel) => ({
      path: rel,
      text: readFileSync(path.join(repoRoot, rel), 'utf8'),
    }));

    const porcelain = execSync('git status --porcelain', {
      encoding: 'utf8',
      cwd: repoRoot,
    });
    const changedPaths = parseGitPorcelainPaths(porcelain);
    const specHealthOnDisk = listSpecHealthFiles(path.join(repoRoot, 'src')).map(
      (abs) => path.relative(repoRoot, abs).replace(/\\/g, '/'),
    );

    const result = evaluatePlayerProductGuards({
      preloadModule: preload.compilerOptions.module,
      sources,
      changedPaths: [...changedPaths, ...specHealthOnDisk],
    });

    expect(preload.compilerOptions.module).toBe('CommonJS');
    expect(result.preloadCommonJs).toBe(true);
    expect(result.mediaEngineUnused).toBe(true);
    expect(result.noHlsProbeOnPlay).toBe(true);
    expect(result.noSpecHealthInProduct).toBe(true);
    expect(result.violations).toEqual([]);
    expect(specHealthOnDisk).toEqual([]);
  });
});

function listSpecHealthFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      found.push(...listSpecHealthFiles(abs));
      continue;
    }
    if (/SPEC-HEALTH/i.test(entry)) found.push(abs);
  }
  return found;
}
