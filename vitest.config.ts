import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'release', 'tests/e2e/**'],
    // Per-file environment overrides for the player surface area.
    // Player tests touch `window`, `document`, `HTMLMediaElement` — they
    // need a DOM-ish environment. We default to `happy-dom` (lighter than
    // jsdom) for everything under `tests/unit/player/**` and the renderer
    // `src/renderer/features/player/**`. Tests that want a different
    // environment (e.g. `node`) can override with a
    // `// @vitest-environment node` docblock at the top of the file.
    environmentMatchGlobs: [
      ['tests/unit/player/**', 'happy-dom'],
      ['src/renderer/features/player/**', 'happy-dom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.d.ts'],
    },
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@licensing-api': path.resolve(__dirname, 'src/licensing-api'),
    },
  },
});
