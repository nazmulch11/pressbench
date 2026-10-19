# Test cases: Workspace shell (TC-WS)

| ID        | Title                                | Level     | Priority | Steps                                                | Expected                                                 | Automation |
| --------- | ------------------------------------ | --------- | -------- | ---------------------------------------------------- | -------------------------------------------------------- | ---------- |
| TC-WS-001 | Layout shows four regions            | e2e       | P0       | Open a project                                       | File tree, editor, preview and bottom panel are visible  | todo       |
| TC-WS-002 | Panels resize and remember size      | e2e       | P1       | Drag the splitter; reload                            | Size is kept after reload                                | todo       |
| TC-WS-003 | Create file                          | component | P0       | Right-click folder → New file → type `a.php` → Enter | `a.php` appears, sorted, and opens in a tab              | todo       |
| TC-WS-004 | Rename file                          | component | P0       | Select file → F2 → new name → Enter                  | Tree and open tab show the new name                      | todo       |
| TC-WS-005 | Delete file asks first               | component | P0       | Select file → Delete                                 | Confirm dialog; on confirm the file and its tab are gone | todo       |
| TC-WS-006 | Reject invalid names                 | unit      | P0       | Validate `''`, `a/b`, `..`, `CON`, name with `\0`    | Each is rejected with a reason                           | todo       |
| TC-WS-007 | Drag file into folder                | e2e       | P1       | Drag `a.php` onto `includes/`                        | File moves; open tab path updates                        | todo       |
| TC-WS-008 | Keyboard-only tree navigation        | e2e       | P0       | Tab into tree; use arrow keys, Enter, F2, Delete     | All actions work without a mouse; focus is visible       | todo       |
| TC-WS-009 | Tabs open, switch and close          | component | P0       | Open three files; Ctrl/Cmd+W on the middle one       | Two tabs left; the next tab is active                    | todo       |
| TC-WS-010 | Unsaved marker and close warning     | e2e       | P0       | Edit a file; try to close its tab                    | Dot marker shown; dialog offers Save, Don't save, Cancel | todo       |
| TC-WS-011 | Command palette runs a command       | e2e       | P1       | Ctrl/Cmd+K → type "new file" → Enter                 | New-file prompt opens                                    | todo       |
| TC-WS-012 | Workspace has no serious a11y issues | e2e       | P0       | Run axe on the workspace                             | Zero serious or critical violations                      | todo       |
