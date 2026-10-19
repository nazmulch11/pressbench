# ADR 0002: No PHP language server in the browser for the MVP

- Status: accepted (research note, Phase 3 spike)
- Date: 2026-10-20
- Deciders: Nazmul (recorded by the Phase 3 agent session)

## Context

Phase 3 ships WordPress-aware completion and hover from generated data (`src/data/wp-functions.json`,
`src/data/wp-hooks.json`). The plan asked for a time-boxed spike (2 days) on whether a real PHP language server
could run in a web worker, which would add project-wide symbols, go-to-definition and diagnostics.

The spike was done as desk research in a fraction of the time box: reading the candidates' documentation and
package layouts, plus a few web searches. Nothing was benchmarked in a worker. Claims below are marked as
**verified** (read in the source or documentation) or **expected** (from the project's design; to check before
building on it).

## Options considered

1. **Intelephense** (the de-facto PHP language server for VS Code).
   - Verified: it is a Node.js language server, proprietary and freemium; the documentation describes installing
     the VS Code extension or running the server over LSP from an editor. No browser or web-worker build is
     documented ([intelephense.com/docs](https://intelephense.com/docs)).
   - Expected: the server depends on Node APIs (file system, worker threads) and its licence does not allow
     bundling the core into another product. Not an option.
2. **Phpactor** (open source, written in PHP).
   - Verified: it needs a PHP runtime; there is no WebAssembly or browser distribution. Searches for "phpactor
     wasm" return only PHP-in-WebAssembly projects, not Phpactor.
   - Expected: it could in principle run inside the PHP WebAssembly that Playground already loads
     ([WordPress Playground: WebAssembly PHP](https://developer.wordpress.org/playground/developers/architecture/wasm-php-overview/),
     [php-wasm](https://gittrend.io/repo/seanmorris/php-wasm)), but Phpactor expects a long-running process
     speaking LSP over stdio, Composer autoloading of hundreds of classes and an index of the whole WordPress
     tree. Playground runs PHP per request inside its own worker and has no stdio transport. Feasible only as a
     research project, not inside this MVP.
3. **Tree-sitter PHP in a worker** (`web-tree-sitter` + a `tree-sitter-php.wasm` grammar).
   - Verified: `web-tree-sitter` (MIT, 0.27.x) runs in browsers, loads a runtime `.wasm` and one `.wasm` per
     grammar, and documents the Vite setup ([web-tree-sitter README](https://cdn.jsdelivr.net/npm/web-tree-sitter@0.27.0/README.md)).
     A prebuilt `tree-sitter-php.wasm` was not located during the spike; building one needs the tree-sitter CLI
     with Emscripten or Docker.
   - Expected: gives a concrete syntax tree only: document outline, local function and class names, bracket
     structure and syntax-error diagnostics. No types, no cross-file resolution, no WordPress knowledge. Roughly
     1 MB of WebAssembly, loaded lazily.
4. **A pure-JavaScript PHP parser** (for example `php-parser` by glayzzle, MIT, on npm).
   - Expected: same capabilities as option 3 (AST, syntax errors, symbols) with no WebAssembly and a simpler
     build; slower on very large files but WordPress plugin files are small. To be verified before V2.
5. **Keep the generated data only** (what Phase 3 ships).
   - Verified: completion and hover for 3,598 global functions and 2,604 hooks work in a plain Monaco provider,
     the data loads lazily as JSON (about 320 KB gzipped for both files) and needs no worker at all.

## Decision

The MVP keeps option 5. No full PHP language server runs in a web worker today: the two real servers either
forbid it (Intelephense) or need a PHP process with a transport that Playground does not offer (Phpactor).

For V2 the recommended next step is option 4 or 3 in a web worker: parse the active file, give Monaco a
document-symbol provider (outline), local completion for the file's own functions and classes, and syntax-error
markers that the debug panel (Phase 6) can share. The WordPress data stays the source of core function and hook
knowledge. A Phpactor-in-Playground experiment is worth a separate, explicitly experimental spike once Playground
exposes a long-lived PHP process.

## Consequences

- Positive: no new runtime dependency in the MVP; the editor chunk stays Monaco plus two JSON files; completion
  works offline once loaded.
- Negative: no project-wide symbols, go-to-definition or type-aware diagnostics for PHP in V1. Users get
  WordPress core knowledge, not knowledge of their own plugin beyond what Monaco's word-based features offer.
- Follow-ups: V2 spike on a worker-based parser (options 3 or 4) with a measured budget (load time, parse time
  for a 2,000-line file, memory); revisit Phpactor if Playground gains a persistent PHP process.
