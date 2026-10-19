# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Phase 3 editor (`src/features/editor`): Monaco replaces the placeholder text area. It is lazy-loaded (its own
  `monaco` chunk, requested only once a file is open) and bundled from npm with Vite web workers, no CDN.
  Highlighting for PHP, JavaScript, TypeScript, JSX/TSX, CSS, SCSS, HTML, JSON and Markdown; the theme follows
  the system colour scheme and `data-theme`.
- WordPress completion in PHP files: 3,598 global functions with signatures, summaries and reference links
  (deprecated ones marked and sorted last), and hook names inside `add_action`, `add_filter`, `do_action`,
  `apply_filters`, `remove_action` and `remove_filter` (actions and filters separately, triggered by the quote).
- Hover docs for WordPress functions (signature, parameters, description, developer.wordpress.org link) and for
  quoted hook names inside hook calls.
- `npm run generate:wp-data` (`scripts/generate-wp-data.ts` + `scripts/wp-data/`): builds
  `src/data/wp-functions.json` from `php-stubs/wordpress-stubs` v7.1.2 (downloaded at a pinned tag) and
  `src/data/wp-hooks.json` from `@wp-hooks/wordpress-core` 1.13.0 (WordPress 7.1). Both files carry a `source`
  block with the version; unit tests check it.
- Ctrl/Cmd+S saves from inside Monaco; Ctrl/Cmd+K opens the palette from inside Monaco; Shift+Alt+F and the new
  "Format document" command format JavaScript, TypeScript, CSS, SCSS and JSON with Prettier (WordPress-style
  options: tabs, 80 columns, single quotes). PHP shows a notice that formatting comes later.
- `src/lib/wp-data` (data types and cached loader) and `src/lib/format` (Prettier standalone with lazy plugins).
  A failed save or format shows its reason under the editor.
- Workspace store: `requestEditorAction` / `clearEditorRequest` (palette → editor), and `?debug=1` exposes
  `window.__PRESSBENCH__.workspaceStore`.
- ADR 0002: a PHP language server cannot run in a web worker today; V2 should try a worker-based parser.
- Test cases TC-ED-001 to TC-ED-023, all automated: 8 e2e (three browsers, including a real completion list, hook
  completion, hover, save, format, lazy loading and axe with the editor open), the rest unit and component.
- Phase 3 test run record (`docs/test-runs/2026-10-20-phase-3.md`).

- Phase 2 workspace shell (`src/features/workspace`): header with the product name and a "Commands" button, a
  resizable layout (sidebar, editor column with tabs and a bottom panel, preview) split by keyboard-operable
  splitters (`role="separator"`, arrow keys, Home, End). Panel sizes and visibility are remembered per browser.
- File tree (`src/features/file-tree`): a WAI-ARIA tree (flat rows with `aria-level`, `aria-posinset`,
  `aria-setsize`, roving tabindex). Create file and folder, rename (F2), delete with a confirmation (Delete), move
  by dragging or through "Move to…", context menu (right-click, Shift+F10, ContextMenu key). Every action works
  with the mouse and with the keyboard alone; moves and deletes are announced in a polite live region.
- Tabs: open, switch, close (close button, middle click, Ctrl/Cmd+W, "Close tab" command), reorder by dragging or
  with Alt+Shift+ArrowLeft/ArrowRight, unsaved marker ("name, unsaved" plus a dot), and a Save / Don't save /
  Cancel dialog when an edited tab is closed. Tabs and drafts follow renames, moves and deletes in the tree.
- Command palette (Ctrl/Cmd+K or the Commands button): New file, New folder, Save file, Rename file, Close tab,
  Toggle sidebar, Toggle preview, Toggle bottom panel, Reset layout. Combobox over a listbox, filtered by every
  word typed.
- Placeholder editor: a plain text area over the active file with drafts and Ctrl/Cmd+S until Monaco arrives in
  Phase 3.
- `src/lib/fs`: in-memory `ProjectFs` (`read`, `write`, `mkdir`, `rename`, `remove`, `exists`, `stat`, `list`,
  `entries`, `onChange`) with name and path validation (empty, slashes, `.` and `..`, control characters and
  `< > : " | ? *`, Windows reserved names, trailing dot or space, 255-character limit, no absolute paths) and
  natural, folder-first sorting; `buildTree` / `flattenTree` for the tree view.
- `src/lib/storage/preferences.ts`: small JSON preferences over `localStorage` with an in-memory fallback when the
  storage is missing or throws.
- `src/stores`: the Zustand workspace store (project files, tabs, drafts, layout, palette state, tree requests),
  created per instance with `createWorkspaceStore()` and provided through `WorkspaceStoreProvider` /
  `useWorkspaceStore(selector)`. The demo project (`my-plugin/`) lives in `src/stores/demo-project.ts`.
- Shared UI in `src/ui`: `Splitter`, `Dialog` (focus trap, Escape, focus restore) and `Menu`.
- Test cases TC-WS-001 to TC-WS-025, all automated: 8 e2e (three browsers, including axe in light and dark mode
  and with the palette open), the rest unit and component. `tests/e2e/pages/workspace.ts` page object, exposed as
  the `workspace` fixture.
- `.claude/launch.json` so agent browser tools can start the dev server by name.
- Phase 2 test run record (`docs/test-runs/2026-10-20-phase-2.md`) with the independent review's findings and fixes.

- Phase 1 Playground spike: `src/lib/playground/` wraps `@wp-playground/client` behind a `PlaygroundService`
  interface (boot with chosen WordPress and PHP versions, run PHP, read/write/list files, activate plugins, HTTP
  requests against the site, navigate the preview, persist a folder to the origin-private file system). Every
  method returns a `Result`; PHP fatal errors come back as values with message, exit code and stderr.
- `createPlaygroundService({ connect })` core shared by the browser (`createWebPlaygroundService`) and the Node
  integration tests (`@wp-playground/cli`); `createFakePlaygroundService()` for unit and component tests, checked
  against a shared contract suite.
- Spike panel (`src/features/preview/PlaygroundPanel`): version pickers, "Keep files between reloads", start/retry,
  status with boot time, and the WordPress iframe. Boot gives up with a clear error after 120 s.
- Persistence is reported per browser (`on`, `off`, `unavailable` with the browser's reason); WebKit refuses the
  origin-private file system inside the Playground iframe and the panel says so.
- `?debug=1` exposes `window.__PRESSBENCH__.playgroundService` and `window.__PRESSBENCH__.playground`.
- `src/lib/result.ts`: `Result<T, E>` with `ok()` and `err()`.
- Test cases TC-PG-001 to TC-PG-014, all automated: 4 e2e (three browsers), 5 integration on real PHP, the rest unit
  and component. ESLint boundary test (TC-PG-008) runs the real config through the ESLint API.
- ADR 0001 updated with measured boot times, the persistence matrix and the remote-hosting decision.

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

### Fixed

- Dark-mode contrast of the primary button: new `--color-on-accent` token (white in light, near-black in dark).
- Playwright no longer overrides the browsers' user agent: with the override, the Playground remote could not load
  its module web worker and never booted (see `docs/TESTING.md` section 5).

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

- Dependencies: `monaco-editor` 0.57.0 (MIT, 101 MB unpacked on disk, 4.5 MB / 1.1 MB gzipped in the lazy chunk,
  Microsoft, last release 2026-09), `@monaco-editor/react` 4.7.0 (MIT, 153 KB, suren-atoyan, last release
  2025-11), `prettier` 3.9.10 moved to runtime dependencies for in-browser formatting (MIT; only `standalone`
  plus the babel, estree and postcss plugins are loaded, lazily), and dev-only `@wp-hooks/wordpress-core` 1.13.0
  (GPL-3.0-or-later, 3.7 MB, John Blackbourn, last release 2026-08) as the hooks source. The WordPress stubs
  (`php-stubs/wordpress-stubs`, MIT) are downloaded, not installed.
- Rolldown `codeSplitting` puts `monaco-editor` into a `monaco` chunk with `includeDependenciesRecursively:
false`; with the default, Vite's preload helper landed in that chunk and the entry preloaded Monaco.
- ESLint ignores Vite `?worker` imports for `import-x/no-unresolved` and `import-x/default`.
- The Phase 2 e2e tests that typed into the text area now use the Monaco helpers; Monaco's accessible text box
  is zero-width, so TC-WS-007 asserts `toBeAttached()` instead of visibility.
- `App` now takes the store and the editor slot from `main.tsx` instead of creating the store itself.
- Dependency: `zustand` 5.0.15 (MIT, 95 KB unpacked, about 1 KB gzipped for the vanilla store plus the React
  binding, maintained by pmndrs, last release 2026-08). Chosen in the plan for small, testable stores.
- The file tree renders flat rows instead of nested `treeitem` / `group` elements: with nesting, axe reported
  `label-content-name-mismatch` (serious) because a folder's visible text included its children.
- The tree's live region uses `aria-live="polite"`, not `role="status"`, because the Playground panel owns the
  page's status role and the Phase 1 e2e tests locate it by role.
- Features compose through slots: `App` passes `<FileTree />` and `<PlaygroundPanel />` into `Workspace`'s
  `sidebar` and `preview` props, so no feature imports another.
- Dependencies: `@wp-playground/client` 3.1.59 (GPL-2.0-or-later, ~3.4 MB unpacked, actively maintained by the
  WordPress project; lazy-loaded so it stays out of the initial bundle) and `@wp-playground/cli` 3.1.59 (dev only,
  same licence and maintainers) for integration tests. Both declare `node >= 24.18`; they run on Node 22 (npm warns).
- ESLint: `tests/integration/**` may import `@wp-playground/*` (it is the Node harness, not app code).
- Props are typed with `interface …Props` (the stylistic preset asks for it); `docs/CODING_STANDARDS.md` updated.
- Pull request template with the definition-of-done checklist.
- `package.json` marked `private` and `UNLICENSED` until a licence is chosen.
- Git hooks live in `scripts/git-hooks/` (Husky).
- `PW_CHROMIUM_EXECUTABLE` and `PW_NO_VIDEO` environment switches for sandboxes with a pre-installed Chromium.
