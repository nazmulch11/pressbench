# Pressbench

A browser-based IDE for WordPress plugin and theme developers. Open a link, build a plugin, test it on different
WordPress and PHP versions, and export it. Nothing to install. WordPress runs inside your browser through
[WordPress Playground](https://developer.wordpress.org/playground/).

> Status: Phase 3 (editor) built. The app opens with a demo plugin in a resizable workspace: file tree
> (create, rename, move, delete; mouse and keyboard), tabs with unsaved markers, a command palette (Ctrl/Cmd+K), a
> Monaco editor with WordPress function and hook completion, hover docs, Ctrl/Cmd+S and Prettier formatting for
> JS/CSS, and the Phase 1 Playground panel in the preview area. Live preview arrives in Phase 4. See the
> [implementation plan](docs/IMPLEMENTATION_PLAN.md).

## Quick start

```bash
cd pressbench
nvm use            # Node 22 LTS (22.12 or newer)
npm install
npx playwright install chromium firefox webkit
npm run dev        # http://localhost:5173
```

## One-time setup

These steps could not be done automatically and need doing once on your machine:

1. `git init && git add -A && git commit -m "chore: phase 0 foundation"` (the git hooks activate on the next
   `npm install` after `git init`).
2. Copy the GitHub files into place:

   ```bash
   mkdir -p .github/workflows
   cp docs/templates/ci.yml .github/workflows/ci.yml
   cp docs/templates/pull_request_template.md .github/pull_request_template.md
   ```

3. Run the full browser suite once: `npm run test:e2e:repeat` (Chromium, Firefox and WebKit, 3 runs each). The
   Playground tests need network access to `playground.wordpress.net`.

Before opening a pull request:

```bash
npm run check
npm run test:e2e:repeat
```

## Documentation

| Document                                           | What it covers                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md) | Phases, tasks, exit gates, timeline, traceability                        |
| [Architecture](docs/ARCHITECTURE.md)               | Modules, folder layout, data flow                                        |
| [Coding standards](docs/CODING_STANDARDS.md)       | TypeScript, React, naming, boundaries, generated WordPress code          |
| [Testing](docs/TESTING.md)                         | Test levels, commands, real-browser runs, flake policy, manual checklist |
| [Debugging](docs/DEBUGGING.md)                     | Bug-fix workflow, debug mode, tools                                      |
| [Updating](docs/UPDATING.md)                       | Dependencies, docs, AGENTS.md / CLAUDE.md, releases                      |
| [Test cases](docs/test-cases/README.md)            | Every planned test case by area                                          |
| [Decisions](docs/adr/README.md)                    | Architecture decision records                                            |
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md)    | Rules for AI coding agents                                               |
| [Contributing](CONTRIBUTING.md)                    | How to propose changes                                                   |
| [Test runs](docs/test-runs/README.md)              | Recorded results of phase and release test runs                          |
| [Changelog](CHANGELOG.md)                          | What changed in each version                                             |

## Licence

Not chosen yet. Until then the project is private and all rights are reserved (`"license": "UNLICENSED"` in
`package.json`). WordPress Playground, which Pressbench builds on, is GPL-2.0-or-later; take that into account, with
legal advice, before choosing. Generated plugin and theme code defaults to GPL-2.0-or-later.
