import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      // Stub out react-tv-space-navigation for non-Electron / non-TV contexts.
      // The real package requires react-native which is not installed.
      // In production Electron builds this alias is removed and the real library is used.
      'react-tv-space-navigation': path.resolve(__dirname, 'src/renderer/lib/tv-space-nav-shim.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
