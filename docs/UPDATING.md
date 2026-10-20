# Update instructions

How to keep Pressbench's code, dependencies, docs and agent instructions current. Follow the matching section every
time; each ends with a checklist to paste into the pull request.

## 1. Which document to update

| You changed…                                           | Update                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Any user-visible behaviour                             | `CHANGELOG.md` (Unreleased), user docs if they mention it                   |
| A feature's expected behaviour                         | Its file in `docs/test-cases/` (add or edit cases, never reuse IDs)         |
| Phase scope, order or status                           | `docs/IMPLEMENTATION_PLAN.md` (phase section, timeline, traceability table) |
| A module, folder or data flow                          | `docs/ARCHITECTURE.md`                                                      |
| A significant technical decision                       | New ADR in `docs/adr/`                                                      |
| A coding rule or lint config                           | `docs/CODING_STANDARDS.md`                                                  |
| Test tooling, commands, thresholds                     | `docs/TESTING.md`                                                           |
| A command, workflow rule or "don't do this" for agents | `AGENTS.md` (and `CLAUDE.md` only for Claude-specific notes)                |
| Setup steps or scripts                                 | `README.md` quick start                                                     |

## 2. Updating dependencies

### Routine updates (every two weeks)

1. Create a branch `chore/deps-YYYY-MM-DD`.
2. `npm outdated` and read the changelog of every package with a new **major** version before touching it.
3. Update patch and minor versions: `npx npm-check-updates -u --target minor && npm install`.
4. Run `npm run check`, `npm run test:integration` and `npm run test:e2e:repeat`.
5. Do the manual checklist items for areas the packages affect (for example Monaco → editor items).
6. One major upgrade per pull request, with its migration notes in the PR description.
7. Keep ESLint on 9.x until `eslint-plugin-react` and `eslint-plugin-jsx-a11y` support ESLint 10
   (`npm view eslint-plugin-react peerDependencies`).
8. Never update `typescript` past the range supported by `typescript-eslint` (check
   `npm view typescript-eslint peerDependencies`).

### WordPress Playground (`@wp-playground/*`)

Playground is the riskiest dependency. Upgrade it alone, never bundled with other changes.

1. Read the Playground release notes and changelog since the pinned version.
2. Update all `@wp-playground/*` packages to the **same** version.
3. Run the Playground contract tests (TC-PG-*) on all three browsers, 3× each.
4. Re-measure cold and warm boot; if either is >20% slower, note it in the PR and decide before merging.
5. Check the list of supported WordPress and PHP versions; update the version picker options and their tests.
6. If self-hosting the remote, deploy the matching remote version in the same release.

### Monaco

1. Update `monaco-editor` and `@monaco-editor/react` together.
2. Run editor tests (TC-ED-*); check completion and hover by hand in all three browsers.
3. Check the editor chunk size against the budget (TC-HD-001).

### WordPress data (functions and hooks)

Regenerate when a new WordPress major version is released.

1. Bump `STUBS_VERSION` in `scripts/wp-data/sources.ts` to the new `php-stubs/wordpress-stubs` tag and update the
   `@wp-hooks/wordpress-core` dev dependency.
2. `npm run generate:wp-data` (downloads the tag into `scripts/.cache/`; `--stubs <file>` uses a local copy).
3. Review the diff of `src/data/*.json`: new functions and hooks expected; removals need a look. The files are
   one entry per line so the diff is readable.
4. The generated files record their source versions in their `source` block; TC-ED-017 checks they match the pins.
5. Run `npm test` (TC-ED-003 to TC-ED-007, TC-ED-015 to TC-ED-018) and the editor e2e cases (TC-ED-008, 011, 012).

## 3. Updating docs

- Docs change in the **same pull request** as the code they describe.
- Keep the "Last reviewed" date at the top of `IMPLEMENTATION_PLAN.md` current when you edit it.
- `npm run docs:check` validates: links between docs, test case IDs are unique, every automated case has a matching
  test title, and the traceability table totals match the case files.
- Write plainly: short sentences, specific numbers, examples over adjectives.

## 4. Updating AGENTS.md and CLAUDE.md

`AGENTS.md` is the single source of rules for every AI coding agent (Claude Code, Codex, Cursor, others).
`CLAUDE.md` imports it with `@AGENTS.md` and adds only Claude-specific notes, so the rules never drift apart.

Update them when:

- a command is added, renamed or removed;
- a workflow rule changes (testing, review, release);
- an agent made the same mistake twice: add a short "Do not…" rule with the reason;
- the folder layout or module boundaries change.

How:

1. Edit `AGENTS.md` first. Keep it under ~250 lines; link to docs instead of copying them.
2. Touch `CLAUDE.md` only if the change is specific to Claude Code (tools, permissions, slash commands).
3. Note the change in `CHANGELOG.md` under "Internal".
4. In the PR, say which agent behaviour the change is meant to fix or enable.

## 5. Releasing

Versioning follows [Semantic Versioning](https://semver.org/). Before 1.0, minor versions may contain breaking changes.

1. Make sure `main` is green in CI.
2. Run the full manual checklist ([TESTING.md](TESTING.md) section 7) on all target browsers and record results in the
   release issue.
3. Move "Unreleased" entries in `CHANGELOG.md` to the new version with today's date.
4. Bump the version in `package.json`, commit `chore(release): vX.Y.Z`, tag `vX.Y.Z`.
5. Deploy, then smoke-test the live URL in Chrome, Firefox and Safari.
6. If a release breaks something: roll back to the previous tag first, investigate second.

## 6. Pull request checklist for updates

- [ ] Correct docs updated (section 1)
- [ ] `CHANGELOG.md` updated
- [ ] `npm run check`, `npm run test:integration`, `npm run test:e2e:repeat` pass
- [ ] Manual check in a real browser done for affected areas
- [ ] `AGENTS.md` / `CLAUDE.md` updated if commands or workflow changed
