# Debugging guide

How to find and fix problems in Pressbench, and the order to do it in.

## 1. Bug-fix workflow (always in this order)

1. **Reproduce.** Write down exact steps, browser and version, and the project used. If you cannot reproduce it, say so
   in the issue and collect more data (section 3) before changing code.
2. **Write a failing test** at the lowest level that shows the bug. Give it a new test case ID in the matching
   [test-cases/](test-cases/) file with the note `regression for #<issue>`.
3. **Run it and watch it fail** for the right reason.
4. **Find the cause** with the tools below. Fix the cause, not the symptom.
5. **Run the test again; it must pass.** Then run the whole suite: `npm run check` and `npm run test:e2e:repeat`.
6. **Check by hand in a real browser** with the original reproduction steps.
7. **Record it**: `CHANGELOG.md` under "Fixed", the issue number, and anything future developers should know in the
   relevant doc.

Never delete or weaken an existing test to make a fix pass. If a test was wrong, explain why in the PR.

## 2. Turning on debug output

- Add `?debug=1` to the URL. The logger switches to `debug` level and keeps the last 1,000 entries in
  `window.__PRESSBENCH_LOGS__`.
- Log namespaces: `playground`, `sync`, `editor`, `fs`, `storage`, `scaffold`, `ui`. Filter with
  `?debug=playground,sync`.
- Never log file contents, tokens or personal data, even at `debug` level.

```ts
import { createLogger } from '@/lib/logger';

const log = createLogger('sync');

log.debug('write queued', { path, bytes: content.length });
```

## 3. Where to look

| Symptom                                    | First place to look                                                    | Then                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Playground never becomes ready             | Browser console and Network tab for `remote.html` and `.wasm` requests | `?debug=playground`; try another browser; check storage quota                                 |
| PHP fatal error or white screen in preview | Pressbench debug panel                                                 | `wp-content/debug.log` through `client.readFileAsText()`; run the snippet with `client.run()` |
| Saved change not in preview                | `?debug=sync` logs                                                     | Read the file back from Playground and compare with the editor                                |
| Files missing after reload                 | Application tab → Storage → OPFS / IndexedDB                           | Check quota and whether the browser is in private mode                                        |
| Autocomplete missing                       | `?debug=editor`; is the data file loaded?                              | Unit-test the provider with the same text and cursor position                                 |
| Test passes locally, fails in CI           | Playwright trace from the CI artifact                                  | Run locally with `CI=1` and the same browser project                                          |
| Test fails 1 run in 9                      | Trace of the failed repeat                                             | See the flake policy in [TESTING.md](TESTING.md)                                              |

## 4. Tools

### Browser DevTools

- **Console**: errors and Pressbench logs.
- **Network**: Playground remote, wasm and data files; watch for failed or slow requests.
- **Application → Storage**: OPFS (through the "Storage" panel in Chromium) and IndexedDB; "Clear site data" for a
  clean start.
- **Performance**: record a save → preview cycle to find slow steps.
- **Memory**: heap snapshots when the tab grows over time (Playground plus Monaco is large; look for leaked iframes or
  Monaco models that were never disposed).

### Inside Playground

From the console with `?debug=1`, `window.__PRESSBENCH__` exposes two handles once WordPress is running:
`playgroundService` (Pressbench's wrapper, every call returns a `Result`) and `playground` (the raw
`@wp-playground/client` instance):

```js
const service = window.__PRESSBENCH__.playgroundService;
await service.run('<?php echo PHP_VERSION;'); // { ok: true, value: { output: '8.3.33', … } }
await service.readFile('/wordpress/wp-content/debug.log');
service.state; // { status: 'ready', bootMs, versions, persistence }

const pg = window.__PRESSBENCH__.playground;
await pg.run({ code: '<?php echo PHP_VERSION;' });
await pg.listFiles('/wordpress/wp-content/plugins');
```

These hooks only exist in debug mode and are never shipped enabled. The E2E tests drive the service through
`playgroundService`.

### Playwright

- `npm run test:e2e:headed -- --project=webkit --grep TC-RT-002`: watch it run.
- `npm run test:e2e:ui`: step through, pick locators, time-travel.
- `PWDEBUG=1 npx playwright test …`: Playwright Inspector with breakpoints.
- `npx playwright show-trace test-results/…/trace.zip`: DOM snapshots, network and console for each step.
- Put `await page.pause()` in a test while investigating; never commit it.

### Vitest

- `npm run test:watch -- slug`: rerun one file on save.
- `vitest --inspect-brk`, then attach Chrome DevTools or VS Code to step through.

## 5. Reporting a bug

Use [templates/bug-report.md](templates/bug-report.md). Include: steps, expected, actual, browser and version, OS,
Pressbench version, logs from `?debug=1` (Help → Report a problem copies them), and a screenshot or video.

## 6. Severity labels

| Label               | Meaning                                 | Response                   |
| ------------------- | --------------------------------------- | -------------------------- |
| `severity:critical` | Data loss, app unusable, security issue | Fix before anything else   |
| `severity:high`     | Main flow broken in one browser         | Fix in the current phase   |
| `severity:medium`   | Feature broken with a workaround        | Schedule within two phases |
| `severity:low`      | Cosmetic                                | Backlog                    |
