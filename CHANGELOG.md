# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Phase 0 foundation: Vite 8 + React 19 + TypeScript 6 (strict) app with a placeholder home screen in light and dark
  themes.
- Logger (`src/lib/logger`) with levels, namespaces, `?debug=1` / `?debug=<namespaces>` and an in-memory log buffer
  exposed as `window.__PRESSBENCH_LOGS__` in debug mode.
- Test tooling: Vitest with coverage thresholds, Playwright for Chromium, Firefox and WebKit with a console-error guard
  and axe accessibility checks, and an integration test config for Phase 1.
- `npm run docs:check`: verifies links, test case IDs, automated test titles and the traceability table.
- ESLint 9 rules that enforce module boundaries (Playground and storage access, no cross-feature imports), Prettier,
  and Husky + lint-staged git hooks.
- CI workflow (`docs/templates/ci.yml`) running checks, then E2E 3× per browser.
- Test cases TC-FND-007 to TC-FND-010; 9 of 10 foundation cases automated.
- `@vitest/eslint-plugin` for test lint rules.
- Phase 0 test run record in `docs/test-runs/`.
- Implementation plan, architecture, coding standards, testing, debugging and update guides.
- 88 planned test cases across 10 areas in `docs/test-cases/`.
- `AGENTS.md` and `CLAUDE.md` with the agent workflow and definition of done.
- ADR 0001: browser-first on WordPress Playground.

### Fixed (from the independent Phase 0 review)

- React recommended lint rules were silently dropped by the config merge; they are now enforced.
- Skipped, `todo` and commented-out tests no longer count as automated in the docs check, and Vitest lint rules
  block skipped, focused and commented-out tests.
- Docs check: handles padded table cells, aligned separator rows, root-relative and folder links, reference-style
  links and `~~~` fences; reports blank traceability counts and a missing Total row.
- Browser code no longer sees Node types (`tsconfig.node.json` split).
- Debug namespaces match regardless of case (`?debug=debugPanel`).
- Storage boundary also catches `window.indexedDB`, `self.indexedDB` and `window.navigator.storage`; new feature
  folders are isolated automatically.
- CI: read-only permissions; runs on `main` are no longer cancelled.
- E2E always builds fresh instead of reusing a running server; the build check tolerates several script chunks.
- "app mounted" is logged after React commits, not before.

### Internal

- Pull request template with the definition-of-done checklist.
- `package.json` marked `private` and `UNLICENSED` until a licence is chosen.
- Git hooks live in `scripts/git-hooks/` (Husky).
- `PW_CHROMIUM_EXECUTABLE` and `PW_NO_VIDEO` environment switches for sandboxes with a pre-installed Chromium.
