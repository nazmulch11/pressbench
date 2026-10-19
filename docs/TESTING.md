# Testing guide

Pressbench is only as good as its tests. This guide says what to test, how, and when a change counts as tested.

## 1. The rule in one line

**Write test cases first, automate them at the right level, run end-to-end tests 3 times on 3 real browsers, then
check the feature by hand in a real browser.**

## 2. Test levels

| Level       | Tool                          | Lives in                          | Runs in                        | What it is for                                                                   | Speed               |
| ----------- | ----------------------------- | --------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- | ------------------- |
| Unit        | Vitest                        | next to source: `foo.test.ts`     | Node (jsdom when needed)       | Pure logic: parsers, validators, stores, providers                               | ms                  |
| Component   | Vitest + Testing Library      | next to source: `Foo.test.tsx`    | jsdom                          | One React component with fakes for services                                      | ms                  |
| Integration | Vitest + `@wp-playground/cli` | `tests/integration/`              | Node, real PHP (WebAssembly)   | Real WordPress behaviour without a browser: scaffolds activate, PHP errors parse | seconds             |
| End-to-end  | Playwright                    | `tests/e2e/`                      | Real Chromium, Firefox, WebKit | Full user flows in the real app                                                  | seconds to a minute |
| Manual      | You, in a real browser        | PR description, release checklist | Real browser                   | What automation misses: feel, layout, console noise                              | minutes             |

Aim for many unit tests, a solid set of component and integration tests, and E2E tests for every user-visible flow
(every `e2e` case in [test-cases/](test-cases/)).

## 3. Commands

| Command                                         | What it does                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm test`                                      | Unit + component tests once                                                  |
| `npm run test:watch`                            | Unit + component tests in watch mode                                         |
| `npm run test:coverage`                         | Unit + component with coverage report and thresholds                         |
| `npm run test:integration`                      | Integration tests (real PHP in Node)                                         |
| `npm run test:e2e`                              | E2E once on Chromium, Firefox, WebKit                                        |
| `npm run test:e2e:repeat`                       | E2E with `--repeat-each=3` on all three browsers (**required before merge**) |
| `npm run test:e2e:headed -- --project=chromium` | Watch the test drive a visible browser                                       |
| `npm run test:e2e:ui`                           | Playwright UI mode for writing and debugging tests                           |
| `npx playwright test --grep TC-RT`              | Run only one area's cases                                                    |
| `npx playwright show-report`                    | Open the last HTML report                                                    |
| `npx playwright show-trace <trace.zip>`         | Step through a recorded failure                                              |
| `npm run check`                                 | Lint + format check + typecheck + unit/component + coverage + docs check     |

## 4. Writing tests

### Naming and traceability

- Every automated test title starts with its test case ID: `test('TC-PRJ-007 rejects unsafe zip paths', …)`.
- One test case ID per test. If a case needs several tests, suffix them: `TC-PRJ-007a`, `TC-PRJ-007b`.
- `describe` blocks name the unit or feature, not the ID.

### Shape of a good test

- **Arrange, act, assert**, separated by a blank line.
- Test behaviour through public APIs. Do not test private functions or implementation details.
- One reason to fail per test. Several `expect` calls are fine if they check one behaviour.
- No sleeps. In Playwright use web-first assertions (`await expect(locator).toBeVisible()`); in Vitest use fake timers.
- Use role-based locators: `getByRole('button', { name: 'New file' })`. Add `data-testid` only when no accessible name
  exists, and treat that as an accessibility smell to fix.
- Fixtures live in `tests/fixtures/`. Never depend on the network except the Playground remote, and mock that too in
  tests that are not about Playground.

### Example: unit test

```ts
import { describe, expect, it } from 'vitest';
import { toSlug } from './slug';

describe('toSlug', () => {
  it('TC-SC-001 turns a plugin name into a slug', () => {
    const name = 'My Cool Plugin!';

    const slug = toSlug(name);

    expect(slug).toBe('my-cool-plugin');
  });
});
```

### Example: end-to-end test

```ts
import { expect, test } from '../fixtures/pressbench';

test('TC-RT-002 save updates the preview', async ({ page, workspace }) => {
  await workspace.openFile('my-plugin/my-plugin.php');

  await workspace.replaceInEditor("'Hello'", "'Hello Pressbench'");
  await workspace.save();

  await expect(workspace.preview.getByText('Hello Pressbench')).toBeVisible({ timeout: 5_000 });
});
```

`tests/e2e/fixtures/pressbench.ts` provides page objects (`workspace`, `projects`, `debugPanel`) and fails any test
that logs a console error or an unhandled rejection (see section 6).

## 5. Running in real browsers, multiple times

### Required before every merge

1. `npm run test:e2e:repeat` on your machine: every test, three browsers, three runs each.
2. CI runs the same command. A pull request cannot merge unless it is green.
3. **Manual check in a real browser** (section 7, the items that touch your change). Paste the result into the PR:
   browser and version, what you did, a screenshot, and "console clean: yes/no".

### Why three times

Playground boots, iframes and file sync are asynchronous. A test that passes once can still be racy. Three repeats in
three engines (27 runs per test) catch most timing bugs before users do.

### Flake policy

- A test that fails in **any** repeat is failing. Do not re-run CI to get a green tick.
- Find the cause with the trace (kept for every failed run). Common causes: waiting on time instead of state,
  shared state between tests, missing `await`.
- If it cannot be fixed the same day: mark it `test.fixme()` with a linked issue labelled `flaky`, and add the case
  to the manual checklist until it is fixed. Flaky tests may not stay in `fixme` for more than one week.

### Playwright configuration (key parts)

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // repeats find flakes; retries would hide them
  timeout: 60_000, // Playground cold boot is slow
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Retries are set to 0 on purpose, because a retry hides a flake. Traces, screenshots and videos are kept for every
failed run instead. The real config also reads two optional environment switches for sandboxes that ship their own
Chromium without ffmpeg: `PW_CHROMIUM_EXECUTABLE=<path to chrome>` and `PW_NO_VIDEO=1`. Leave both unset on developer
machines and in CI.

The real config strips `userAgent` from the device presets (`withoutUserAgent(devices['Desktop Chrome'])`). With
Playwright's user-agent override in place, the WordPress Playground remote cannot load its module web worker inside
the cross-origin iframe and boot never completes (found in Phase 1 on Chromium 156). The browsers' own user agents
are used instead; viewport and screen presets are kept.

## 6. Shared E2E guards

The custom fixture in `tests/e2e/fixtures/pressbench.ts` must:

- Collect `console` messages of type `error` and `pageerror` events; fail the test at teardown if any appeared,
  except entries in an explicit, commented allow-list. The list currently has one entry: Firefox logs a
  service-worker error from `playground.wordpress.net/sw.js` for a request with an empty URL inside the WordPress
  iframe. It comes from the hosted remote, not from Pressbench.
- Run axe (`@axe-core/playwright`) when a test calls `await a11y.check()`; fail on serious or critical issues.
- Boot Playground once per worker where possible and reset state between tests, to keep runs fast.
- Attach Pressbench's own logs (`window.__PRESSBENCH_LOGS__`, available when `?debug=1`) to the report on failure.
- Provide the `workspace` page object (`tests/e2e/pages/workspace.ts`): tree items, tabs, editor, palette, and
  helpers such as `createFile()` and `dragTreeItem()` (pointer-event drag with `mouse.move` / `down` / `up`).

## 7. Manual checklist (real browser)

Run the relevant items for every PR, and the whole list before every release, in Chrome, Firefox and Safari on macOS
and Chrome and Firefox on Windows (or Linux). Open DevTools first and keep the console visible.

- [ ] App loads; console shows no errors or warnings from Pressbench
- [ ] Create a new plugin from the wizard; it opens and activates
- [ ] Edit the main file, save, preview updates
- [ ] Autocomplete shows WordPress functions and hooks
- [ ] Hover shows docs for `add_action`
- [ ] Create, rename, move and delete a file
- [ ] Trigger a PHP warning; it shows in the debug panel; click jumps to the line
- [ ] Switch PHP version; files are kept
- [ ] Reload the browser; project and tabs come back
- [ ] Export a zip; install it on a real WordPress site
- [ ] Import that zip back; files are identical
- [ ] Create a share link; open it in a private window
- [ ] Keyboard only: complete the create → edit → save → export flow
- [ ] Resize to 1280×720 and 1920×1080; nothing overlaps
- [ ] Throttle network to "Fast 4G"; app still boots with a progress indicator

### For AI agents

Agents that have browser tools (for example Claude in Chrome or the built-in browser) must also do the manual check:
start `npm run dev`, open the URL, perform the steps for the changed feature, read the console, and report what they
saw. An agent that cannot open a browser must say so in its summary instead of claiming the check was done.

## 8. Coverage

Coverage is a floor, not a goal. Thresholds in `vitest.config.ts`:

| Scope             | Lines | Branches |
| ----------------- | ----- | -------- |
| `src/lib/**`      | 90%   | 85%      |
| `src/features/**` | 80%   | 70%      |
| Whole project     | 80%   | 70%      |

Lowering a threshold needs a written reason in the PR and an approving review.

## 9. Continuous integration

`.github/workflows/ci.yml` (source: `docs/templates/ci.yml`) runs on pushes to `main` and on every pull request:

1. `npm ci`
2. `npm run check`
3. `npm run test:integration`
4. `npx playwright install --with-deps chromium firefox webkit`
5. `npm run test:e2e:repeat`
6. Scaffold job: generate every template, run PHPCS with the WordPress standard and Plugin Check on the output
7. Upload the Playwright HTML report and traces as artifacts on failure
