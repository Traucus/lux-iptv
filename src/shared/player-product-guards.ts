export type PlayerProductSource = {
  path: string;
  text: string;
};

export type PlayerProductGuardInput = {
  preloadModule: string;
  sources: PlayerProductSource[];
  changedPaths: string[];
};

export type PlayerProductGuardResult = {
  preloadCommonJs: boolean;
  mediaEngineUnused: boolean;
  noHlsProbeOnPlay: boolean;
  noSpecHealthInProduct: boolean;
  violations: string[];
  mediaEngineHits: string[];
  hlsHits: string[];
  specHits: string[];
};

const MEDIA_ENGINE_IMPORT = /from\s+['"][^'"]*media-engine['"]/;
const CREATE_MEDIA_ENGINE = /\bcreateMediaEngine\s*\(/;
const HLS_JS_IMPORT = /from\s+['"]hls\.js['"]/;
const MPEGTS_IMPORT = /from\s+['"]mpegts\.js['"]/;
const PLAY_PATH = /(?:PlayerPage\.tsx|VideoPlayer\.tsx|handlers\/player\.ts)$/;

export function parseGitPorcelainPaths(porcelain: string): string[] {
  return porcelain
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const renamed = line.match(/->\s+(.+)$/);
      const renamedPath = renamed?.[1]?.trim();
      if (renamedPath) return renamedPath;
      return line.slice(3).trim();
    });
}

export function isProductPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalized.startsWith('openspec/')) return false;
  if (normalized.startsWith('docs/planning/')) return false;
  if (normalized.startsWith('Documentos/')) return false;
  return (
    normalized.startsWith('src/') ||
    normalized.startsWith('electron/') ||
    normalized === 'package.json'
  );
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function isMediaEngineModule(filePath: string): boolean {
  return normalizePath(filePath).endsWith('media-engine.ts');
}

function isPlayPath(filePath: string): boolean {
  return PLAY_PATH.test(normalizePath(filePath));
}

export function evaluatePlayerProductGuards(
  input: PlayerProductGuardInput,
): PlayerProductGuardResult {
  const mediaEngineHits = input.sources
    .filter((source) => !isMediaEngineModule(source.path))
    .filter(
      (source) =>
        MEDIA_ENGINE_IMPORT.test(source.text) || CREATE_MEDIA_ENGINE.test(source.text),
    )
    .map((source) => source.path);

  const hlsHits = input.sources
    .filter((source) => isPlayPath(source.path))
    .filter(
      (source) =>
        CREATE_MEDIA_ENGINE.test(source.text) ||
        HLS_JS_IMPORT.test(source.text) ||
        MPEGTS_IMPORT.test(source.text) ||
        MEDIA_ENGINE_IMPORT.test(source.text),
    )
    .map((source) => source.path);

  const specHits = input.changedPaths.filter((filePath) => {
    const normalized = normalizePath(filePath);
    return /SPEC-HEALTH/i.test(normalized) && isProductPath(normalized);
  });

  const preloadCommonJs = input.preloadModule === 'CommonJS';
  const violations: string[] = [];
  if (!preloadCommonJs) violations.push('preload-not-commonjs');
  if (mediaEngineHits.length > 0) violations.push('media-engine-used');
  if (hlsHits.length > 0) violations.push('hls-probe-on-play');
  if (specHits.length > 0) violations.push('spec-health-in-product');

  return {
    preloadCommonJs,
    mediaEngineUnused: mediaEngineHits.length === 0,
    noHlsProbeOnPlay: hlsHits.length === 0,
    noSpecHealthInProduct: specHits.length === 0,
    violations,
    mediaEngineHits,
    hlsHits,
    specHits,
  };
}
