# Test cases

Each file lists the test cases for one area. Write cases here **before** writing the feature code.

## Rules

- ID format: `TC-<AREA>-<NNN>`, three digits, never reused. Retired cases stay in the file with status `retired`.
- **Level**: `unit`, `component`, `integration` (Playground in Node via `@wp-playground/cli`), `e2e` (Playwright, real
  browsers) or `manual`.
- **Priority**: `P0` must pass for any release, `P1` must pass for a minor release, `P2` nice to have.
- **Automation**: the path of the test file once automated, or `manual`, or `todo`.
- Automated tests put the ID at the start of the test title: `test('TC-WS-003 renames a file', …)`.
- `npm run docs:check` fails if a case marked with a path has no test whose title contains its ID.
- For a long case, use the full [test case template](../templates/test-case.md) in its own section below the table.

## Area prefixes

| Prefix | Area                     | File                                   |
| ------ | ------------------------ | -------------------------------------- |
| TC-FND | Foundation and tooling   | [00-foundation.md](00-foundation.md)   |
| TC-PG  | Playground integration   | [01-playground.md](01-playground.md)   |
| TC-WS  | Workspace shell          | [02-workspace.md](02-workspace.md)     |
| TC-ED  | Editor                   | [03-editor.md](03-editor.md)           |
| TC-RT  | Runtime and live preview | [04-runtime.md](04-runtime.md)         |
| TC-SC  | Scaffolding              | [05-scaffolding.md](05-scaffolding.md) |
| TC-DBG | Debug panel              | [06-debug-panel.md](06-debug-panel.md) |
| TC-PRJ | Projects                 | [07-projects.md](07-projects.md)       |
| TC-SH  | Sharing                  | [08-sharing.md](08-sharing.md)         |
| TC-HD  | Hardening                | [09-hardening.md](09-hardening.md)     |
