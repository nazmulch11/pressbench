# ADR 0001: Browser-first on WordPress Playground

- Status: accepted (Phase 1 measurements recorded 2026-10-20)
- Date: 2026-10-19
- Deciders: Nazmul

## Context

Pressbench must let a developer start coding a WordPress plugin with zero local setup. Options considered:
a VS Code extension, a desktop IDE (Code-OSS / Theia fork), or a browser app on WordPress Playground.

## Decision

Build a browser app. WordPress runs in the tab through `@wp-playground/client`; the editor is Monaco. All access to
Playground goes through `src/lib/playground/` so it can be replaced or upgraded in one place.

## Consequences

- Positive: zero install, shareable links, near-zero hosting cost, works on any desktop browser.
- Negative: no full Xdebug-style debugger in MVP; storage can be cleared by the browser; memory limits on large sites;
  some PHP network behaviour differs from a real server.
- Follow-ups: Phase 1 spike measures boot time and memory per browser and decides whether to self-host the remote.

## Phase 1 measurements (2026-10-20)

Measured on the owner's Mac (Darwin 25.6) against the production build on `localhost:4173`, with the hosted remote
`https://playground.wordpress.net/remote.html` serving WordPress 7.1.3 and PHP 8.3.33. "Cold" is the first boot in a
fresh browser context; "warm" is a second boot in the same context after a page reload (the remote's service worker
and caches are then populated). Times are `bootMs` from `PlaygroundService` (click to `isReady()`), one sample each,
on a residential connection; treat them as an order of magnitude, not a benchmark.

| Browser  | Version      | Cold boot (s) | Warm boot (s) | Memory after boot (MB)  | OPFS persists after reload |
| -------- | ------------ | ------------- | ------------- | ----------------------- | -------------------------- |
| Chromium | 156.0.8078.4 | 5.2           | 1.7           | +629 (RSS, 304 → 933)   | Yes                        |
| Firefox  | 157.0        | 9.7           | 11.1          | +411 (RSS, 968 → 1,379) | Yes                        |
| WebKit   | 27.2         | 5.3           | 3.9           | +455 (RSS, 335 → 790)   | **No** (see below)         |

Memory is the resident set size of the whole browser process tree (sum over the engine's processes, so shared pages
are counted more than once) 2 s after ready, minus the same figure with only the Pressbench page open. It covers the
Playground iframe, its web worker and the PHP WebAssembly heap, which the page's own `performance.memory` (10 MB)
does not see. Firefox's warm boot being slower than its cold boot is one sample of noise on a shared connection, not
a trend; the three boots of each test in the 3× E2E run were all in the 9 to 30 s band under parallel load.

Real Chrome 155 on the same machine booted in 2.5 to 3.5 s (warm, through Claude in Chrome). Under the full E2E run
(nine browser contexts booting at once) single boots took up to 30 s, which is why the E2E boot timeout is 90 s and
the service gives up after 120 s.

Storage quota was not measured: Playground mounts OPFS inside its own origin (`playground.wordpress.net`), so the
quota is that origin's partitioned quota, and Pressbench cannot query it from `localhost`. Phase 7 revisits this when
project files move to Pressbench's own storage.

### Known browser gaps

- **WebKit: no persistence.** `mountOpfs` inside the cross-origin Playground iframe fails with "The operation failed
  for an unknown transient reason (e.g. out of memory)", which is WebKit refusing the origin-private file system to a
  third-party frame. The service reports `persistence: 'unavailable'` and the panel says "Files will not be kept".
  TC-PG-006 asserts this matrix. Any persistence Pressbench relies on must live in Pressbench's own origin
  (Phase 7: `src/lib/storage/`), not in the Playground mount.
- **Firefox: service-worker noise.** The remote's `sw.js` logs "Failed to load ‘’. A ServiceWorker intercepted the
  request and encountered an unexpected error" for an empty-URL request from inside WordPress. WordPress works; the
  E2E console guard allow-lists this one message.
- **All engines under Playwright: user-agent override breaks boot.** With Playwright's `userAgent` emulation the
  remote's module web worker never loads. The Playwright config uses the real user agents (`withoutUserAgent`).
- **Hosted remote ships WordPress "latest" as 7.1** with a minified build that logs a PHP notice about
  `wp_maybe_inline_styles` and the Twenty Twenty-Five stylesheet; the default theme renders unstyled in the preview.
  Upstream issue; not caused by Pressbench.
- **`@wp-playground/*` 3.1.59 declares `node >= 24.18`** while the project pins Node 22. Everything works on Node 22;
  npm prints an engine warning. Revisit when moving to Node 24.

## Remote hosting decision

**Use the hosted remote (`https://playground.wordpress.net/remote.html`) for the MVP.**

Options considered:

1. Hosted remote (chosen): zero infrastructure, always current WordPress and PHP builds, the WordPress project
   maintains it. Risks: the npm client (`@wp-playground/client` 3.1.59, bundled by Pressbench) can drift from the
   deployed remote; the README of the client recommends loading the client from the same deployment. Mitigation:
   the pinned version is tested against the live remote by the Playground contract tests (TC-PG-001 to 006) on every
   change, and `docs/UPDATING.md` requires re-running them when the client is upgraded. If a mismatch appears, switch
   the import to `https://playground.wordpress.net/client/index.js` (a one-line change in `src/lib/playground/web.ts`
   plus a type-only dependency) before self-hosting.
2. Self-host the remote: the `@wp-playground/remote` npm package contains only type declarations; a self-hosted
   remote means building the Playground monorepo and serving `remote.html`, the PHP WebAssembly binaries and the
   service worker from Pressbench's origin. That is a build pipeline and a CDN bill the MVP does not need. It would
   make persistence same-origin (fixing the WebKit gap for the Playground mount) and allow a strict Content Security
   Policy, so it stays on the table for Phase 9 hardening or V2.
