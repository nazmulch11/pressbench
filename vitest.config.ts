import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
        exclude: [
          'scripts/docs-check/cli.ts',
          'scripts/generate-wp-data.ts',
          'scripts/**/*.test.ts',
          'src/main.tsx',
          'src/test/**',
          'src/**/*.test.{ts,tsx}',
          'src/**/*.d.ts',
          'src/data/**',
        ],
        reporter: ['text', 'html'],
        thresholds: {
          lines: 80,
          branches: 70,
          'src/lib/**': { lines: 90, branches: 85 },
          'src/features/**': { lines: 80, branches: 70 },
        },
      },
    },
  }),
);
