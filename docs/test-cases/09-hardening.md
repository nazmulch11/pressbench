# Test cases: Hardening and beta (TC-HD)

| ID        | Title                        | Level       | Priority | Steps                                                                         | Expected                                                          | Automation |
| --------- | ---------------------------- | ----------- | -------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| TC-HD-001 | Initial bundle budget        | integration | P0       | Build; measure gzip size of entry chunks                                      | Under 300 KB, Monaco excluded                                     | todo       |
| TC-HD-002 | Lighthouse performance       | manual      | P1       | Lighthouse on `/` in Chromium                                                 | Performance score ≥ 85                                            | manual     |
| TC-HD-003 | axe on every screen          | e2e         | P0       | Visit every route and dialog; run axe                                         | Zero serious or critical violations                               | todo       |
| TC-HD-004 | Keyboard-only walkthrough    | manual      | P0       | Create plugin → edit → save → preview → export using keyboard only            | Every step possible; focus always visible                         | manual     |
| TC-HD-005 | Screen reader smoke test     | manual      | P1       | VoiceOver (macOS) and NVDA (Windows) over main flow                           | Controls announced with names and roles                           | manual     |
| TC-HD-006 | Report a problem copies logs | e2e         | P1       | Open Help → Report a problem → Copy                                           | Clipboard has app version, browser, recent logs, no file contents | todo       |
| TC-HD-007 | Full manual checklist        | manual      | P0       | Run [TESTING.md](../TESTING.md) section 7 on 3 browsers × 2 operating systems | All items pass and are recorded                                   | manual     |
