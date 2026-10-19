import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

// Integration tests run real PHP (WebAssembly) in Node through @wp-playground/cli.
// They are added from Phase 1 onwards; until then the run passes with no tests.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['tests/integration/**/*.test.ts'],
      environment: 'node',
      testTimeout: 120_000,
      hookTimeout: 120_000,
      passWithNoTests: true,
    },
  }),
);
