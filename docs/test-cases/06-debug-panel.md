# Test cases: Debug panel (TC-DBG)

| ID         | Title                                 | Level     | Priority | Steps                                                                                   | Expected                                        | Automation |
| ---------- | ------------------------------------- | --------- | -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| TC-DBG-001 | Parse fatal error                     | unit      | P0       | Parse a sample `PHP Fatal error: … in /wordpress/wp-content/plugins/x/x.php on line 12` | `{ level: 'fatal', file: 'x/x.php', line: 12 }` | todo       |
| TC-DBG-002 | Parse warning, notice, deprecated     | unit      | P0       | Parse a fixture log with one of each                                                    | Three entries with correct levels               | todo       |
| TC-DBG-003 | Multi-line stack traces stay together | unit      | P1       | Parse fatal with stack trace                                                            | One entry; trace attached                       | todo       |
| TC-DBG-004 | Errors appear in the panel            | e2e       | P0       | Save a plugin that triggers a warning; load preview                                     | Panel shows the warning with file and line      | todo       |
| TC-DBG-005 | Click jumps to line                   | e2e       | P0       | Click the error                                                                         | File opens; cursor on that line                 | todo       |
| TC-DBG-006 | Log filter and clear                  | component | P1       | Filter to warnings; Clear                                                               | Only warnings shown; then empty                 | todo       |
| TC-DBG-007 | Editor marker on error line           | e2e       | P1       | Trigger error at line 12                                                                | Monaco marker on line 12                        | todo       |
