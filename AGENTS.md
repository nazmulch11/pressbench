# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor and others) working on Pressbench. This file is the
single source of agent rules. `CLAUDE.md` imports it. Humans should follow it too.

## Project

Pressbench is a browser-based IDE for WordPress plugin and theme developers. WordPress runs in the browser through
WordPress Playground (`@wp-playground/client`); the editor is Monaco; the app is Vite + React + TypeScript.

- Plan and current phase: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- Architecture and folder layout: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Coding rules: [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
- Testing: [docs/TESTING.md](docs/TESTING.md) · Debugging: [docs/DEBUGGING.md](docs/DEBUGGING.md)
- Updating deps, docs and this file: [docs/UPDATING.md](docs/UPDATING.md)

**Current status:** Phase 3 (editor) built on branch `feat/editor`; its exit gate passed locally (see
`docs/test-runs/2026-10-20-phase-3.md`). Phases 0 to 2 are merged into `main`. Phase 4 (runtime and live preview) is
next. Update this line when a phase changes.

## Commands

Node 22 LTS. Use `npm`, not yarn or pnpm.

```bash
npm install                 # install
npm run dev                 # dev server at http://localhost:5173
npm run build               # production build
npm run preview             # serve the build at http://localhost:4173
npm run lint                # ESLint, zero warnings allowed
npm run format              # Prettier write
npm run format:check        # Prettier check (used by check)
npm run typecheck           # tsc --noEmit
npm test                    # unit + component tests (Vitest)
npm run test:coverage       # with coverage thresholds
npm run test:integration    # real PHP in Node (@wp-playground/cli)
npm run test:e2e            # Playwright: Chromium, Firefox, WebKit
npm run test:e2e:repeat     # same, --repeat-each=3  (REQUIRED before you say a task is done)
npm run check               # lint + format check + typecheck + unit + coverage + docs check
npm run docs:check          # links, test case IDs, test titles, traceability table
npm run generate:wp-data    # regenerate WordPress function/hook data
```

If a command above does not exist yet (Phase 0 creates them), create it as described in the plan rather than
inventing a different name.

## How to do a task (follow every time)

1. **Read** the relevant phase in the plan and the test case file for the area.
2. **Write or update test cases first** in `docs/test-cases/<area>.md` (template: `docs/templates/test-case.md`).
   New IDs only; never reuse or renumber.
3. **Write the tests** at the lowest level that proves the behaviour. Put the case ID at the start of the test title:
   `it('TC-ED-004 suggests action hooks inside add_action', …)`.
4. **Run them and confirm they fail** for the expected reason.
5. **Implement** the smallest change that makes them pass, following the coding standards.
6. **Run the checks:** `npm run check`, then `npm run test:integration` if PHP or Playground is involved, then
   `npm run test:e2e:repeat`. All must pass. Fix failures; do not skip or weaken tests.
7. **Check in a real browser.** Start `npm run dev`, open it with your browser tool, perform the feature's steps, read
   the console. Report browser, what you did and what you saw. If you have no browser tool, say so plainly: never
   claim a manual check you did not do.
8. **Update docs** in the same change: test-case file (automation path), traceability table in the plan,
   `CHANGELOG.md` (Unreleased), and any doc listed in `docs/UPDATING.md` section 1.
9. **Summarise**: what changed, test case IDs covered, commands run with results, browser check result, open issues.

For bugs: reproduce → add a regression test case → failing test → fix → steps 6 to 9. See `docs/DEBUGGING.md`.

## Rules that are easy to break

- Only `src/lib/playground/` may import `@wp-playground/*`. Only `src/lib/storage/` may touch OPFS or IndexedDB.
- Features do not import from other features; share through `src/lib/` or a store.
- No `any`, no non-null `!` outside tests, no `console.log` (use `createLogger`), no floating promises.
- No sleeps or fixed timeouts in tests; use web-first assertions and fake timers.
- E2E retries are 0 on purpose. A test that fails in any of the 3 repeats is failing; do not re-run until it passes.
- Never delete, skip (`.skip`, `.only`, `fixme`) or loosen a test to get green, unless the plan's flake policy is
  followed and an issue is linked.
- Generated WordPress PHP must pass PHPCS (WordPress standard): `ABSPATH` guard, prefixes, escaping, nonces,
  capability checks, translatable strings.
- Treat imported zips, share links and project files as untrusted input.
- Do not add dependencies without stating why, size, licence and maintenance status in the summary.
- Do not upgrade `@wp-playground/*` together with anything else. Do not move TypeScript past what `typescript-eslint`
  supports.
- Do not put "WordPress" in product names, package names or domains (trademark policy).
- Do not commit secrets, `.env` files, test videos or `test-results/`.
- Keep ESLint on 9.x for now: `eslint-plugin-react` and `eslint-plugin-jsx-a11y` do not support ESLint 10 yet.
- Record phase exit-gate runs in `docs/test-runs/`, including what could not be run and why.
- The project has no licence yet (`UNLICENSED`). Do not add a `LICENSE` file or licence headers until the owner
  decides.

## Definition of done

- [ ] Test cases written first and listed by ID
- [ ] Unit/component tests pass; coverage thresholds hold
- [ ] E2E pass 3× on Chromium, Firefox and WebKit (`npm run test:e2e:repeat`)
- [ ] Real-browser check done and reported (or clearly stated as not possible)
- [ ] `npm run check` clean: zero errors, zero warnings
- [ ] Docs, `CHANGELOG.md`, traceability table updated
- [ ] This file updated if commands, workflow or layout changed

## Commits and pull requests

- Conventional Commits: `feat(editor): …`, `fix(sync): …`, `test(projects): …`, `docs: …`, `chore(deps): …`.
- One logical change per commit/PR. Fill in every item of `.github/pull_request_template.md`
  (source copy: `docs/templates/pull_request_template.md`; keep the two identical).
- Never push to `main` directly. Never force-push shared branches.

## Keeping this file useful

When you hit the same problem twice, or a reviewer corrects the same thing twice, add a one-line rule above with the
reason. Keep this file short; link to `docs/` for detail. See `docs/UPDATING.md` section 4.
