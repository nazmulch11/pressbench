import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Folders the test tools write into; the dev server must never watch them. */
const GENERATED_REPORT_DIRS = ['coverage', 'playwright-report', 'test-results', 'blob-report'];

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
    watch: {
      // Test reports are HTML pages inside the project root; when Vitest or Playwright rewrote them, the dev server
      // reloaded the open app and wiped the in-memory project and WordPress (TC-FND-011).
      ignored: GENERATED_REPORT_DIRS.flatMap((dir) => {
        // Anchored to the project root, so a folder of the same name inside src/ is still watched.
        const absolute = fileURLToPath(new URL(`./${dir}`, import.meta.url));
        return [absolute, `${absolute}/**`];
      }),
    },
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
