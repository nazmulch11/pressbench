import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Monaco gets a chunk of its own, named so the lazy-loading e2e test (TC-ED-010) can see when it
        // is requested. It is only imported from the lazy editor, so it stays out of the first paint.
        codeSplitting: {
          groups: [
            {
              name: 'monaco',
              test: /node_modules[\\/]monaco-editor[\\/]/,
              // Only Monaco's own modules: with the default (recursive) grouping, Vite's preload helper
              // landed in this chunk and the entry chunk imported it, which preloaded Monaco at first paint.
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
});
