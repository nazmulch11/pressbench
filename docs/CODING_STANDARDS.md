# Coding standards

These rules are enforced by tooling where possible. Where a rule cannot be automated, reviewers check it.
`npm run check` must pass with **zero errors and zero warnings**.

## 1. General

- Code is written for the next reader. Clear names beat comments; comments explain **why**, not what.
- Small units: functions under ~40 lines, files under ~300 lines. Split when it helps reading.
- No dead code, no commented-out code, no `console.log` (use the logger).
- No new dependency without a line in the PR saying why, its size, its licence and its maintenance status.
- English for code, comments, commit messages and docs.

## 2. TypeScript

`tsconfig.json` covers browser code (`src/`) with DOM types only; `tsconfig.node.json` extends it for scripts, configs
and Playwright/integration tests and adds Node types, so Node-only APIs cannot compile in browser code.
`npm run typecheck` checks both. The shared compiler options must include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true
  }
}
```

- No `any`. Use `unknown` and narrow it. `// @ts-expect-error` only with a comment explaining why.
- No non-null assertions (`!`) outside tests.
- Prefer `type` for unions and data shapes, `interface` for objects meant to be implemented (for example service
  contracts like `PlaygroundService`).
- Exported functions have explicit return types.
- Model errors as values where failure is expected: `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`.
  Throw only for programmer errors or truly exceptional states.
- Use discriminated unions for state (`{ status: 'idle' } | { status: 'booting' } | { status: 'ready'; client } | { status: 'error'; error }`),
  never several booleans.

## 3. Naming

| Thing                         | Style                        | Example                    |
| ----------------------------- | ---------------------------- | -------------------------- |
| Files with a React component  | PascalCase                   | `FileTree.tsx`             |
| Other files                   | kebab-case                   | `debug-log-parser.ts`      |
| Components, types, interfaces | PascalCase                   | `FileTree`, `ProjectFile`  |
| Functions, variables          | camelCase                    | `parseDebugLog`            |
| Constants that never change   | UPPER_SNAKE_CASE             | `MAX_SHARE_BYTES`          |
| React hooks                   | `use` prefix                 | `useProject`               |
| Zustand stores                | `use…Store`                  | `useWorkspaceStore`        |
| Booleans                      | `is`, `has`, `can`, `should` | `isDirty`                  |
| Test files                    | same name + `.test`          | `debug-log-parser.test.ts` |

## 4. Project structure and boundaries

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full layout. Enforced with ESLint `no-restricted-imports` and
`import/no-cycle`:

- Only `src/lib/playground/` imports `@wp-playground/*`.
- Only `src/lib/storage/` touches OPFS or IndexedDB.
- `src/features/<name>/` may import from `src/lib/`, `src/ui/` and `src/stores/`, never from another feature
  directly. Share through `src/lib/` or a store; compose features in `src/app/` through slot props (for example
  `<Workspace sidebar={<FileTree />} />`).
- Stores (`src/stores/`) are created per instance (`createWorkspaceStore()`) and reached through React context
  (`useWorkspaceStore(selector)`), never as module singletons, so every test gets a fresh store.
- Each feature exposes a public `index.ts`; other code imports only from it.
- Path alias `@/` maps to `src/`.

## 5. React

- Function components only. Props typed with an exported `interface …Props` (the lint preset asks for `interface`
  over object `type`s).
- Components render; logic lives in hooks or `lib/`. A component with more than ~3 effects is a refactor signal.
- Every interactive element is a real `<button>`, `<a>` or form control, with an accessible name.
- No `dangerouslySetInnerHTML` except for sanitized, trusted content, with a comment.
- Lists use stable keys (file path or id), never array index.
- Expensive children (Monaco, preview iframe) are memoised and never remounted by unrelated state changes.
- Dispose Monaco models and Playground listeners in effect clean-ups.

## 6. Styling

- CSS Modules (`Component.module.css`) with design tokens from `src/ui/tokens.css` (colors, spacing, radius, fonts).
- Light and dark themes through tokens; no hard-coded colors in components.
- Minimum target sizes 24×24 px; visible focus ring on every focusable element.

## 7. Async, errors and logging

- Every promise is awaited or explicitly handled (`@typescript-eslint/no-floating-promises`).
- Every user-facing failure shows a message that says what happened and what to do next, plus a way to copy logs.
- Use `createLogger('<namespace>')`; levels `debug`, `info`, `warn`, `error`. Never log file contents or secrets.
- Long operations show progress and can be cancelled where possible (`AbortSignal`).

## 8. Security

- Treat imported zips, share links and project files as untrusted: validate paths (no `..`, no absolute paths, no
  null bytes), cap sizes, never `eval`.
- The preview iframe is sandboxed as Playground requires; never widen sandbox flags without an ADR.
- Content Security Policy is sent as HTTP headers by the hosting configuration (Phase 9 adds it, with an E2E test).
  It is not a `<meta>` tag because the Vite dev server injects an inline script that a strict policy would block.
  Review it whenever an external origin is added.
- No secrets in the client bundle.

## 9. Generated WordPress code (templates)

Code Pressbench generates for users must be exemplary, because users copy it.

- Follows [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/) (PHP, JS, CSS, HTML).
- Every PHP file starts with the `ABSPATH` guard: `defined( 'ABSPATH' ) || exit;`.
- Prefix all functions, classes, constants and hooks with the plugin slug.
- Escape on output (`esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`), sanitize on input, nonces and capability
  checks on every form and AJAX/REST handler.
- Text domain matches the slug; all user-facing strings are translatable.
- Licence header `GPL-2.0-or-later` by default (allowed by the additional permission in `NOTICE.md`).
- CI runs PHPCS (`WordPress` standard) and Plugin Check on every template output (TC-SC-008).

## 10. Formatting and linting

- Prettier: `printWidth: 100`, `singleQuote: true`, `trailingComma: 'all'`, `semi: true`.
- ESLint 9 flat config (`eslint.config.js`) with `typescript-eslint` (strict-type-checked + stylistic-type-checked), `eslint-plugin-react`,
  `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import-x`, `eslint-plugin-playwright` for
  `tests/e2e`.
- Husky pre-commit runs lint-staged (ESLint fix + Prettier on staged files); pre-push runs `npm run check`.

## 11. Git and pull requests

- Branches: `feat/<short-name>`, `fix/<issue>-<short-name>`, `docs/…`, `chore/…`, `test/…`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat(editor): add hook completion for add_filter`.
- One logical change per pull request; keep PRs under ~400 changed lines where possible.
- The PR template checklist (definition of done) must be fully ticked before review.
- Squash-merge into `main`; `main` is always releasable.

## 12. Documentation in code

- Exported functions, types and components in `src/lib/` have TSDoc comments: what it does, parameters, return value,
  errors, and an example when the use is not obvious.
- Non-obvious decisions get an ADR in [adr/](adr/) and a link in a code comment.
