# ADR 0001: Browser-first on WordPress Playground

- Status: accepted (numbers to be filled in during Phase 1)
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

## Phase 1 measurements (fill in)

| Browser  | Version | Cold boot (s) | Warm boot (s) | Memory after boot (MB) | OPFS persists after reload |
| -------- | ------- | ------------- | ------------- | ---------------------- | -------------------------- |
| Chromium |         |               |               |                        |                            |
| Firefox  |         |               |               |                        |                            |
| WebKit   |         |               |               |                        |                            |

Remote hosting decision: _to be decided in Phase 1._
