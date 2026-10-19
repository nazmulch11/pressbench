# Test cases: Sharing (TC-SH)

| ID        | Title                           | Level | Priority | Steps                                               | Expected                                                            | Automation |
| --------- | ------------------------------- | ----- | -------- | --------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| TC-SH-001 | Encode and decode project       | unit  | P0       | Encode fixture project; decode                      | Identical file map                                                  | todo       |
| TC-SH-002 | Size limit enforced             | unit  | P0       | Encode project above the limit                      | Returns `too-large` result, no URL                                  | todo       |
| TC-SH-003 | Share link opens read-only copy | e2e   | P0       | Create link; open in a new context                  | Project opens; editor is read-only; banner shows "Make my own copy" | todo       |
| TC-SH-004 | Make my own copy                | e2e   | P0       | From TC-SH-003, click "Make my own copy"            | New editable project with same files                                | todo       |
| TC-SH-005 | Cross-browser link              | e2e   | P1       | Create link in Chromium; open in Firefox and WebKit | Same files in each                                                  | todo       |
