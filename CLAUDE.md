# CLAUDE.md

All project rules live in AGENTS.md and are imported here so Claude Code and other agents follow the same rules.

@AGENTS.md

## Claude Code specifics

- **Start of a session:** read `docs/IMPLEMENTATION_PLAN.md` (current phase) and the test case file for the area
  you are touching before editing code.
- **Plan first for anything bigger than a small fix:** write the plan (files to touch, test case IDs to add) and
  confirm before editing. Use plan mode where available.
- **Task list:** track the "How to do a task" steps from AGENTS.md as todos, including "Run e2e 3×" and
  "Check in real browser" as separate items, so neither is skipped.
- **Real-browser check:** use Claude in Chrome or the built-in browser to open `http://localhost:5173` (dev) or
  `http://localhost:4173` (preview). Read console messages and take a screenshot of the result. If no browser tool is
  available in the session, say so in the summary.
- **Long-running commands:** run `npm run dev` in the background; do not block on it. Run
  `npm run test:e2e:repeat` in the foreground and read the full result, not just the exit code.
- **Subagents:** for review, use a separate agent that has not seen the implementation to check the diff against
  `docs/CODING_STANDARDS.md` and the test cases.
- **Never** edit generated files in `src/data/` by hand; run `npm run generate:wp-data`.
- **Updating this file:** only Claude-specific notes go here. General rules go in `AGENTS.md`
  (see `docs/UPDATING.md` section 4).
