# ADR 0003: Self-hosted Playground remote for E2E tests

- Status: accepted
- Date: 2026-11-05
- Deciders: Nazmul

## Context

ADR 0001 chose the hosted Playground remote (`https://playground.wordpress.net/remote.html`) for the MVP. Every E2E
test that starts WordPress loaded it, and CI runs the suite three times in Chromium, Firefox and WebKit, so a single CI
run boots WordPress from the public hosts dozens of times. On CI run 41959770262 (Chromium) TC-PG-006 failed because
`https://wpsandbox.wordpress.net/sw.js` answered `429 Too Many Requests`; the remote then logged "WordPress request
transport did not start" and the boot failed. Rate limiting by a host we do not control makes CI fail for reasons
unrelated to the change under test.

Two further facts came out of the investigation:

- The hosted remote is deployed from upstream's trunk, not from a release. Its current build renders WordPress through
  a bridge iframe on `wpsandbox.wordpress.net`, which does not exist in `v3.1.59`, the version of
  `@wp-playground/client` Pressbench pins. E2E was testing the pinned client against a newer, moving remote.
- Upstream publishes no built remote: `@wp-playground/remote` on npm holds only type declarations, the GitHub releases
  have no assets, and the deploy workflow's artifact is temporary and built for `wpsandbox.wordpress.net`. Upstream's
  guide ([Host your own Playground](https://wordpress.github.io/wordpress-playground/developers/architecture/host-your-own-playground))
  says to build it from source with `npm run build:website`.

## Options considered

1. Keep the hosted remote and lower the load (share one boot per worker, fewer repeats): fewer requests, still rate
   limited, still testing against a moving remote, and the repeat policy exists to catch flaky tests.
2. Intercept the public hosts in Playwright and replay recorded responses: Playwright cannot intercept requests made by
   service workers in Firefox and WebKit, and the remote is built around its service worker. Fragile.
3. Build the remote from upstream's source at the tag matching the pinned client and serve it locally in E2E (chosen).

## Decision

E2E boots WordPress from a remote built from `WordPress/wordpress-playground` at tag `v<client version>`:

- `npm run playground:remote:build` clones the tag into the system temp folder, runs upstream's `npm ci` and
  `npm run build:website` (Node 24.18 or later, upstream's `engine-strict` requirement), copies
  `dist/packages/playground/wasm-wordpress-net` to `scripts/.cache/playground-remote/<version>/` and deletes the clone.
- `npm run playground:remote:serve` serves that folder on `http://127.0.0.1:5400` with a small static server
  (`scripts/playground-remote/serve.ts`, no new dependency). Playwright starts it next to the preview server and builds
  the app with `VITE_PLAYGROUND_REMOTE_URL=http://127.0.0.1:5400/remote.html`.
- The port is fixed: `startPlaygroundWeb` rejects a remote whose origin is not on the client's built-in list
  ("Invalid remote URL"), and `http://127.0.0.1:5400`, upstream's dev server, is the free local origin on it. So
  E2E cannot run while upstream's dev server uses that port.
- `127.0.0.1` is a different site from the app on `localhost`, so the Playground iframe stays third-party as it is in
  production, and the per-engine persistence matrix of TC-PG-006 keeps meaning the same thing (checked: WebKit still
  reports persistence `unavailable`).
- A Playwright fixture fails any test whose browser context requests `playground.wordpress.net` or
  `wpsandbox.wordpress.net` (TC-PG-017).
- CI builds the remote once per client version in the `playground-remote` job and keeps it in the Actions cache; the
  E2E jobs restore it.
- Production builds do not set `VITE_PLAYGROUND_REMOTE_URL` and keep using the hosted remote; ADR 0001's decision for
  users is unchanged.

## Consequences

- E2E no longer depends on the public hosts' availability or rate limits, and tests the pinned client against the
  remote from the same release. Boots got faster: 4 to 14 s per test locally under load, against up to 30 s from
  the hosted remote (ADR 0001).
- Cost: a cold build clones about 2.6 GB, installs about 1.4 GB of upstream dependencies and peaks near 8 GB of
  disk; on the owner's Mac it took about 6.5 minutes (clone 3.5, install 1.2, build 1.7). The built remote is 1.4 GB
  (all PHP versions, WordPress 6.3 to 7.1, beta and nightly) and is kept in `scripts/.cache/` and in the Actions
  cache. A
  developer builds it once per client version before running E2E locally.
- Upstream's build is not fully reproducible: it downloads `wp-cli.phar` from a moving branch. That file is not used
  by Pressbench's tests.
- Upgrading `@wp-playground/client` now also rebuilds the remote (new cache key); `docs/UPDATING.md` lists it.
- The licence of the built remote is GPL-2.0-or-later, compatible with Pressbench's AGPL-3.0-or-later. It is test
  infrastructure and is not shipped in Pressbench's bundle.
- Production still meets the drift and rate-limit risks of the hosted remote. Self-hosting for users stays a Phase 9
  or V2 decision (ADR 0001); this build script is the starting point for it.
