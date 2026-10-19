# Pressbench implementation plan

> Status: living document. Last reviewed: 2026-10-20. Current phase: **Phase 1 built; exit gate passed locally**
> (see [Phase 1 test run](test-runs/2026-10-20-phase-1.md)). Phase 0's CI item passed on the first pull request.
> Phase 2 is next.
> Owner: Nazmul. Update this file whenever a phase starts, finishes or changes scope (see [UPDATING.md](UPDATING.md)).

Pressbench is a browser-based IDE for WordPress plugin and theme developers. It runs WordPress inside the browser with
[WordPress Playground](https://developer.wordpress.org/playground/) (PHP compiled to WebAssembly), so a developer opens a
link and is writing, previewing and exporting a working plugin in under a minute.

This plan covers **Version 1 (MVP)** in detail and Version 2/3 as a roadmap. Every phase ends with an **exit gate**:
the phase is not done until every item in its gate is true.

---

## 1. Non-negotiable working rules

These rules apply to every phase, every feature and every bug fix. They are repeated in [AGENTS.md](../AGENTS.md) so
AI agents follow them too.

1. **Test cases first.** Before writing feature code, add the feature's test cases to the matching file in
   [docs/test-cases/](test-cases/) using the [test case template](templates/test-case.md). Each case gets an ID
   (`TC-<AREA>-<NNN>`).
2. **Every test case is automated or explicitly manual.** Automated tests put the ID in the test title, for example
   `test('TC-RT-001 boots WordPress and shows the homepage', …)`. Manual cases are listed in the release checklist.
3. **Three levels of tests.** Unit (Vitest), component (Vitest + Testing Library), end-to-end in real browsers
   (Playwright). See [TESTING.md](TESTING.md).
4. **Real browsers, multiple times.** Every end-to-end test must pass **3 runs in a row** (`--repeat-each=3`) on
   **Chromium, Firefox and WebKit** before a change is merged. A test that fails once in nine runs is a failing test.
5. **A human-style check in a real browser.** After automated tests pass, open the running app in a real browser,
   exercise the feature by hand, and check the console for errors. Record the result in the pull request.
6. **Bugs start with a failing test.** Reproduce the bug in a test, watch it fail, then fix it. See
   [DEBUGGING.md](DEBUGGING.md).
7. **Coding standards are enforced, not suggested.** Lint, format and type-check must pass with zero warnings.
   Generated PHP must pass WordPress Coding Standards. See [CODING_STANDARDS.md](CODING_STANDARDS.md).
8. **Docs move with code.** A change that alters behaviour updates the docs, the changelog, and, if it changes how
   agents should work, `AGENTS.md` / `CLAUDE.md`, in the same pull request.

### Definition of done (per feature)

- [ ] Test cases written in `docs/test-cases/` before implementation
- [ ] Unit and component tests written and passing
- [ ] End-to-end tests passing 3× on Chromium, Firefox and WebKit
- [ ] Manual check in a real browser done, console clean, screenshot attached to the PR
- [ ] `npm run check` passes (lint, format, types, unit tests, coverage thresholds)
- [ ] Accessibility check (axe) shows no serious or critical issues on touched screens
- [ ] Docs, `CHANGELOG.md` and (if relevant) `AGENTS.md` / `CLAUDE.md` updated
- [ ] Traceability table in section 6 updated

---

## 2. Technology choices

Versions were checked on npm on 2026-10-19. Pin exact versions in `package.json` during Phase 0 and change them only
through the process in [UPDATING.md](UPDATING.md).

| Concern                        | Choice                                           | Version at planning | Why                                                                                      |
| ------------------------------ | ------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------- |
| Language                       | TypeScript (strict)                              | 6.0.x               | `typescript-eslint` 8.x supports TypeScript below 6.1; do not move to TS 7 until it does |
| UI                             | React                                            | 19.x                | Large ecosystem, works with Monaco wrapper                                               |
| Build / dev server             | Vite                                             | 8.x                 | Fast dev server, simple config                                                           |
| Editor                         | Monaco via `@monaco-editor/react`                | 0.57 / 4.7          | The editor inside VS Code                                                                |
| WordPress runtime              | `@wp-playground/client`                          | 3.1.x               | Official Playground client: boot, run PHP, write files                                   |
| Runtime in Node tests          | `@wp-playground/cli`                             | 3.1.x               | Run Playground in Node for fast integration tests                                        |
| State                          | Zustand                                          | 5.x                 | Small, testable stores                                                                   |
| Hook data                      | `@wp-hooks/wordpress-core`                       | 1.13.x              | JSON of WordPress core actions and filters for autocomplete                              |
| Function data                  | `php-stubs/wordpress-stubs` (Composer)           | latest              | Source for function signatures, parsed at build time                                     |
| Zip import/export              | JSZip                                            | 3.10.x              | Read and write plugin zips in the browser                                                |
| Unit / component tests         | Vitest + Testing Library                         | 5.x / 16.x          | Vite-native test runner                                                                  |
| End-to-end tests               | Playwright                                       | 1.64.x              | Real Chromium, Firefox and WebKit, traces and videos                                     |
| Accessibility tests            | `@axe-core/playwright`                           | 4.14.x              | Automated a11y checks inside E2E runs                                                    |
| Lint / format                  | ESLint 10 + typescript-eslint 8, Prettier 3      |                     | Enforced in CI and pre-commit                                                            |
| Git hooks                      | Husky + lint-staged                              | 9.x / 17.x          | Block bad commits locally                                                                |
| PHP standards (generated code) | PHPCS + WordPress Coding Standards, Plugin Check |                     | Scaffolded code must be clean                                                            |

---

## 3. Timeline at a glance

Estimates assume one developer working full time. Each phase has a hard exit gate; do not start the next phase with
an open gate unless the item is moved, in writing, to a later phase.

| Phase | Name                              | Estimate      | Main output                                                               |
| ----- | --------------------------------- | ------------- | ------------------------------------------------------------------------- |
| 0     | Foundation and tooling            | 1 week        | Repo, CI, test harness, docs                                              |
| 1     | Playground spike                  | 1 week        | Proof that boot, file writes, PHP runs and persistence work in 3 browsers |
| 2     | Workspace shell                   | 1 week        | Split layout, file tree, tabs                                             |
| 3     | Editor                            | 1.5 weeks     | Monaco, WordPress autocomplete, hover docs                                |
| 4     | Runtime and live preview          | 1.5 weeks     | Preview, auto-reload, version picker, auto login                          |
| 5     | Scaffolding                       | 1 week        | New plugin, block theme, block                                            |
| 6     | Debug panel                       | 1 week        | PHP errors, debug.log viewer                                              |
| 7     | Projects: storage, import, export | 1 week        | OPFS persistence, zip import/export                                       |
| 8     | Sharing                           | 0.5 week      | Read-only share links                                                     |
| 9     | Hardening and beta                | 1.5 weeks     | Performance, accessibility, docs site, beta launch                        |
|       | **Total MVP**                     | **~11 weeks** |                                                                           |

---

## 4. Phases in detail

Each phase lists: goal, tasks, the test case file, the exit gate.

### Phase 0: Foundation and tooling

**Goal:** an empty app that builds, tests itself in three real browsers, and blocks bad code.

Tasks:

1. Initialise the repo: `git init`, `.gitignore`, `.editorconfig`, `.nvmrc` (Node 22 LTS).
2. Create the Vite + React + TypeScript app using the folder layout in [ARCHITECTURE.md](ARCHITECTURE.md).
3. Configure TypeScript strict mode (see [CODING_STANDARDS.md](CODING_STANDARDS.md)).
4. Configure ESLint (flat config), Prettier, Husky pre-commit with lint-staged.
5. Configure Vitest with coverage (v8) and thresholds; add one sample unit test.
6. Configure Playwright with Chromium, Firefox, WebKit projects, `webServer` pointing at `vite preview`, retries off,
   trace, video and screenshot kept on failure; add one sample E2E test.
7. Add the npm scripts listed in [AGENTS.md](../AGENTS.md#commands) and [TESTING.md](TESTING.md#3-commands):
   `dev`, `build`, `preview`, `lint`, `format`, `format:check`, `typecheck`, `test`, `test:watch`, `test:coverage`,
   `test:integration`, `test:e2e`, `test:e2e:repeat`, `test:e2e:headed`, `test:e2e:ui`, `check`, `docs:check`
   (`scripts/docs-check/`), and `generate:wp-data` (stub until Phase 3).
8. Add a logger module (`src/lib/logger`) with levels and a `?debug=1` switch (see [DEBUGGING.md](DEBUGGING.md)).
9. Add GitHub Actions CI: install, `npm run check`, build, E2E on three browsers with `--repeat-each=3`, upload
   Playwright report as an artifact. The workflow lives in `docs/templates/ci.yml` and is copied to
   `.github/workflows/ci.yml` (see README "One-time setup").
10. Copy `docs/templates/pull_request_template.md` to `.github/pull_request_template.md` (the definition-of-done
    checklist GitHub shows on every pull request).

Test cases: [test-cases/00-foundation.md](test-cases/00-foundation.md)

Exit gate:

- [x] `npm run check` passes locally (2026-10-20)
- [x] `npm run test:e2e:repeat` passes on all three browsers: 63/63 on the owner's Mac (2026-10-20)
- [x] CI green on GitHub, and a deliberately failing test makes CI fail (tested once, then removed): green on
      [PR #2](https://github.com/nazmulch11/pressbench/pull/2), red on the probe PR #1 (2026-10-20, see the
      [Phase 0 test run](test-runs/2026-10-20-phase-0.md))
- [x] A lint error blocks a commit through the pre-commit hook (TC-FND-006, checked 2026-10-20)
- [x] App opens in a real browser with no console errors (built-in browser on macOS and Chromium, 2026-10-20)
- [x] App checked in Chrome 155 by hand, and in Firefox 157 and WebKit 27.2 through a scripted console and screenshot
      check (2026-10-20)

### Phase 1: Playground spike (risk reduction)

**Goal:** prove the risky parts work before building UI on top of them. Code from this phase lives in
`src/lib/playground/` and becomes the only module allowed to import `@wp-playground/client`.

Tasks:

1. Boot Playground into an iframe with `startPlaygroundWeb()` and wait for `isReady()`.
2. Write a PHP file into `/wordpress/wp-content/plugins/…` and activate it.
3. Run PHP with `client.run()` and capture output and errors.
4. Switch WordPress and PHP versions through a Blueprint at boot (`preferredVersions`). Note: a JSON Blueprint only
   runs at initialisation; changes later use Blueprint step functions.
5. Persist files with OPFS and confirm they survive a page reload; measure storage quota per browser. (Quota could
   not be measured: the mount lives in the Playground origin; see ADR 0001.)
6. Measure: cold boot time, warm boot time, memory, in each browser. Record numbers in an ADR.
7. Decide: use `playground.wordpress.net/remote.html` or self-host the remote; record in an ADR.
8. Build a typed wrapper `PlaygroundService` with a fake implementation for unit tests.

Test cases: [test-cases/01-playground.md](test-cases/01-playground.md)

Carried into Phase 2 and Phase 4 (found in the Phase 1 review, not blocking the spike):

- The boot timeout does not cancel the underlying `startPlaygroundWeb()`; a late success after the timeout is ignored
  by the service but still calls `onClientConnected`. Thread an `AbortSignal` when the preview pane is built (Phase 4,
  task 6).
- Boot failures in the panel show the message only; "what to do next" and a copy-logs button come with the preview
  pane's error state (Phase 4, task 6).
- `tests/integration/**` is exempt from the whole `no-restricted-imports` rule, not only the Playground pattern; narrow
  it when a second restricted package appears.

Exit gate:

- [x] All Phase 1 E2E tests pass 3× in Chromium, Firefox and WebKit (99/99 runs for the whole suite, 2026-10-20)
- [x] Known browser gaps written down (WebKit refuses OPFS in the Playground iframe; Firefox service-worker noise;
      Playwright user-agent override breaks boot) in ADR 0001
- [x] ADR written: [adr/0001-browser-first-on-playground.md](adr/0001-browser-first-on-playground.md) updated with
      measured numbers and the remote hosting decision (hosted remote for the MVP)

### Phase 2: Workspace shell

**Goal:** the IDE layout a developer will live in.

Tasks:

1. Resizable split layout: sidebar (file tree), editor area, preview area, bottom panel. Remember sizes per viewer.
2. File tree: create, rename, delete, drag to move, context menu, keyboard navigation.
3. Tabs: open, close, reorder, unsaved marker, close-with-unsaved warning.
4. Command palette (`Ctrl/Cmd+K`) with the first few commands.
5. In-memory virtual file system interface (`ProjectFs`) that later syncs to Playground and OPFS.

Test cases: [test-cases/02-workspace.md](test-cases/02-workspace.md)

Exit gate:

- [ ] All tree and tab operations work with mouse and keyboard only
- [ ] axe reports no serious or critical issues on the workspace
- [ ] E2E suite green 3× on three browsers

### Phase 3: Editor

**Goal:** a code editor that understands WordPress.

Tasks:

1. Integrate Monaco; lazy-load it; syntax highlighting for PHP, JS, TS, JSX, CSS, SCSS, HTML, JSON, Markdown.
2. Build script `scripts/generate-wp-data.ts` that produces `src/data/wp-functions.json` (from wordpress-stubs) and
   `src/data/wp-hooks.json` (from `@wp-hooks/wordpress-core`). Commit the generated files with a version stamp.
3. Completion provider: WordPress functions with signatures; hook names inside `add_action`, `add_filter`,
   `do_action`, `apply_filters`, `remove_action`, `remove_filter`.
4. Hover provider: signature, short description, link to developer.wordpress.org.
5. Save with `Ctrl/Cmd+S`; format document (Prettier for JS/CSS; PHP formatting deferred to V2).
6. Research spike (time-boxed to 2 days): can a PHP language server run in a web worker? Record result in an ADR.

Test cases: [test-cases/03-editor.md](test-cases/03-editor.md)

Exit gate:

- [ ] Completion and hover unit-tested against fixtures; E2E checks a real completion list in three browsers
- [ ] Editor bundle loads lazily; first paint of the app is not blocked by Monaco
- [ ] Generated data files have a recorded source version

### Phase 4: Runtime and live preview

**Goal:** save a file, see WordPress update.

Tasks:

1. Preview pane with the Playground iframe, address bar, back/forward/reload, open in new tab.
2. Sync: on save, write the changed file into Playground; debounce; show sync status.
3. Auto-reload preview after sync; keep the current URL.
4. Version picker for WordPress and PHP; changing it reboots Playground with the project files.
5. Auto login as admin; quick links to wp-admin, the plugin page and the front end.
6. Boot failure handling: clear error, retry button, logs.

Test cases: [test-cases/04-runtime.md](test-cases/04-runtime.md)

Exit gate:

- [ ] Edit → save → preview shows the change in under 2 seconds (warm) in all three browsers
- [ ] Version switch keeps all project files
- [ ] E2E suite green 3× on three browsers

### Phase 5: Scaffolding

**Goal:** a new, standards-clean plugin, block theme or block in one click.

Tasks:

1. Template engine for `templates/` (plain token replacement, no `eval`).
2. New plugin wizard: name, slug, text domain, author, licence (GPL-2.0-or-later default).
3. New block theme: `theme.json`, `style.css`, `templates/index.html`, `parts/header.html`, `parts/footer.html`.
4. New block: `block.json`, `edit.js`, `save.js` or dynamic `render.php`; build step deferred to V2, so MVP blocks use
   plain JS without JSX.
5. Slug and text-domain validation with clear messages.
6. CI job: generate every template, then run PHPCS with WordPress Coding Standards and Plugin Check on the output.

Test cases: [test-cases/05-scaffolding.md](test-cases/05-scaffolding.md)

Exit gate:

- [ ] Every generated project activates in Playground with no PHP notices
- [ ] Generated PHP passes PHPCS (WordPress standard) with zero errors
- [ ] E2E suite green 3× on three browsers

### Phase 6: Debug panel

**Goal:** developers see what went wrong without leaving the IDE.

Tasks:

1. Enable `WP_DEBUG`, `WP_DEBUG_LOG`, `WP_DEBUG_DISPLAY=false` in the Playground boot Blueprint.
2. Errors panel: parse PHP fatal errors, warnings and notices; show file and line; click to jump to the line.
3. Log panel: tail `wp-content/debug.log`; filter by level; clear.
4. Editor markers for errors on the matching line.

Test cases: [test-cases/06-debug-panel.md](test-cases/06-debug-panel.md)

Exit gate:

- [ ] A known fatal error, warning and notice each appear with the right file and line in all three browsers
- [ ] E2E suite green 3× on three browsers

### Phase 7: Projects (storage, import, export)

**Goal:** work survives reloads and moves in and out as normal WordPress zips.

Tasks:

1. Project list: create, open, rename, duplicate, delete (with confirm).
2. Persist project files to OPFS; metadata (name, versions, last opened) to IndexedDB.
3. Import a `.zip` of a plugin or theme; detect type from headers; reject unsafe paths (`../`).
4. Export a WordPress-installable `.zip` with the right top-level folder.
5. Storage quota warning and "export everything" safety button.

Test cases: [test-cases/07-projects.md](test-cases/07-projects.md)

Exit gate:

- [ ] Round trip: import → edit → export → import gives identical files (checked by hash)
- [ ] An exported zip installs on a real WordPress site (manual check, recorded)
- [ ] E2E suite green 3× on three browsers

### Phase 8: Sharing

**Goal:** send a link that opens a read-only copy.

Tasks:

1. Encode small projects (under a size limit set in the spike) into a compressed URL fragment.
2. Opening a share link creates a local, read-only copy with a "Make my own copy" button.
3. Larger projects: show a clear message that cloud sharing comes in V2.

Test cases: [test-cases/08-sharing.md](test-cases/08-sharing.md)

Exit gate:

- [ ] Link created in one browser opens identically in the other two
- [ ] Oversized projects show the message and never produce a broken link

### Phase 9: Hardening and beta

**Goal:** something strangers can use.

Tasks:

1. Performance budgets: initial JS under 300 KB gzip before Monaco; Lighthouse performance ≥ 85 on the landing route.
2. Full accessibility pass: keyboard-only walkthrough, screen reader smoke test, axe on every screen.
3. Content Security Policy and other security headers in the hosting config, with an E2E test that reads them.
4. Error reporting (opt-in) and an in-app "Report a problem" that copies logs.
5. User docs site (getting started, keyboard shortcuts, limits).
6. Run the full manual checklist in [TESTING.md](TESTING.md) section 7 on three browsers and two operating systems.
7. Beta release: tag `v0.1.0`, update `CHANGELOG.md`, publish.

Test cases: [test-cases/09-hardening.md](test-cases/09-hardening.md)

Exit gate:

- [ ] Manual checklist passed and recorded
- [ ] Zero open bugs labelled `severity:critical` or `severity:high`
- [ ] Release notes written

---

## 5. Roadmap after MVP

Full feature descriptions are in the product doc. Each item gets its own phase plan, written in this file, before work
starts.

| Version | Theme                | Key features                                                                                                                                                                                          |
| ------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2      | Test and collaborate | Compatibility matrix, plugin conflict check, PHPUnit runner, PHPCS inline, Plugin Check, GitHub connect, diff view, WP-CLI terminal, database viewer, hook inspector, in-browser JS build, cloud sync |
| V3      | Pro and team         | WordPress-aware AI assistant, shared workspaces, PR previews, code comments, SFTP/SSH and host deploy, WordPress.org release, step debugger, profiler, desktop companion                              |

---

## 6. Traceability

Update this table whenever test cases are added or automated. CI's `npm run docs:check` fails if a test case ID in
`docs/test-cases/` has no matching automated test and is not marked `manual`.

| Area        | Test case file    | Prefix | Cases planned | Manual by design | Automated so far |
| ----------- | ----------------- | ------ | ------------- | ---------------- | ---------------- |
| Foundation  | 00-foundation.md  | TC-FND | 10            | 1                | 9                |
| Playground  | 01-playground.md  | TC-PG  | 14            | 0                | 14               |
| Workspace   | 02-workspace.md   | TC-WS  | 12            | 0                | 0                |
| Editor      | 03-editor.md      | TC-ED  | 10            | 0                | 0                |
| Runtime     | 04-runtime.md     | TC-RT  | 9             | 0                | 0                |
| Scaffolding | 05-scaffolding.md | TC-SC  | 9             | 0                | 0                |
| Debug panel | 06-debug-panel.md | TC-DBG | 7             | 0                | 0                |
| Projects    | 07-projects.md    | TC-PRJ | 10            | 1                | 0                |
| Sharing     | 08-sharing.md     | TC-SH  | 5             | 0                | 0                |
| Hardening   | 09-hardening.md   | TC-HD  | 7             | 4                | 0                |
| **Total**   |                   |        | **93**        | **6**            | **23**           |

---

## 7. Risks

| Risk                                                                | Impact                                               | Mitigation                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Playground behaviour differs between browsers (OPFS, memory)        | Features break in one browser                        | Phase 1 spike in all three browsers; E2E on all three for every change                                         |
| Browser storage cleared by the browser                              | Lost work                                            | Export button, quota warning, cloud sync in V2                                                                 |
| Playground API changes                                              | Breakage on upgrade                                  | Single wrapper module, pinned versions, upgrade checklist in UPDATING.md                                       |
| No full PHP language server in the browser                          | Weaker autocomplete                                  | Generated WordPress data in MVP; spike in Phase 3                                                              |
| Flaky E2E tests hide real bugs                                      | False confidence                                     | 3× repeat rule, flake policy in TESTING.md                                                                     |
| Overlap with my.WordPress.net                                       | Weak positioning                                     | Stay focused on developer jobs: testing, standards, shipping                                                   |
| Licence not yet chosen; `@wp-playground/client` is GPL-2.0-or-later | A closed licence may conflict with bundling GPL code | `package.json` is `private` / `UNLICENSED` until decided; decide (with legal advice) before any public release |
