// ESLint flat config. Rules here enforce docs/CODING_STANDARDS.md; change both together.
import { existsSync, readdirSync } from 'node:fs';

import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { flatConfigs as importX } from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import playwright from 'eslint-plugin-playwright';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { config as defineEslintConfig, configs as tseslintConfigs } from 'typescript-eslint';

/**
 * Feature folders. A feature may not import another feature (CODING_STANDARDS.md §4).
 * Planned features plus any folder that exists, so a new feature is isolated automatically.
 */
const PLANNED_FEATURES = [
  'workspace',
  'file-tree',
  'editor',
  'preview',
  'debug-panel',
  'scaffolding',
  'projects',
  'sharing',
];
const FEATURES_DIR = new URL('./src/features', import.meta.url);
const FEATURES = [
  ...new Set([
    ...PLANNED_FEATURES,
    ...(existsSync(FEATURES_DIR)
      ? readdirSync(FEATURES_DIR, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
      : []),
  ]),
];

const STORAGE_MESSAGE = 'Only src/lib/storage/ may use browser storage (OPFS, IndexedDB).';

export default defineEslintConfig(
  {
    ignores: [
      'dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'node_modules/',
    ],
  },

  js.configs.recommended,
  ...tseslintConfigs.strictTypeChecked,
  ...tseslintConfigs.stylisticTypeChecked,
  importX.recommended,
  importX.typescript,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
      // Vite worker imports (`…/x.worker?worker`) resolve to a virtual module whose default export the
      // resolver cannot see, so the worker files' own exports are not analysed.
      'import-x/ignore': ['\\.worker\\.js$'],
    },
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'import-x/no-cycle': 'error',
      // Vite worker imports (`…/x.worker?worker`) are real modules the resolver cannot see past the query.
      'import-x/no-unresolved': ['error', { ignore: ['\\?worker$'] }],
      'import-x/no-default-export': 'off',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: FEATURES.map((feature) => ({
            target: `./src/features/${feature}`,
            from: './src/features',
            except: [`./${feature}`],
            message:
              'Features may not import other features. Share code through src/lib or a store.',
          })),
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@wp-playground/*'],
              message: 'Only src/lib/playground/ may import WordPress Playground packages.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', { name: 'indexedDB', message: STORAGE_MESSAGE }],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'storage', message: STORAGE_MESSAGE },
        { object: 'window', property: 'indexedDB', message: STORAGE_MESSAGE },
        { object: 'self', property: 'indexedDB', message: STORAGE_MESSAGE },
        { object: 'globalThis', property: 'indexedDB', message: STORAGE_MESSAGE },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[property.name='storage'][object.type='MemberExpression'][object.property.name='navigator']",
          message: STORAGE_MESSAGE,
        },
      ],
    },
  },

  // Browser app code. The two React presets are merged rule by rule; spreading both objects would
  // let the jsx-runtime preset replace the recommended rules.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: react.configs.flat.recommended.plugins,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...jsxA11y.flatConfigs.recommended,
  },

  // Boundary exceptions: the owning modules. The integration harness drives real PHP through
  // @wp-playground/cli in Node; it is test tooling, not app code.
  {
    files: ['src/lib/playground/**', 'tests/integration/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/lib/storage/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  // All tests.
  {
    files: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Unit and component tests (Vitest): no skipped, focused or commented-out tests.
  {
    files: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/integration/**/*.ts'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-commented-out-tests': 'error',
    },
  },

  // End-to-end tests.
  {
    files: ['tests/e2e/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-skipped-test': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-wait-for-timeout': 'error',
    },
  },

  // Node scripts and config files.
  {
    files: ['scripts/**/*.ts', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.js'],
    ...tseslintConfigs.disableTypeChecked,
  },
);
