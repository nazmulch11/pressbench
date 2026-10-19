# Test cases: Runtime and live preview (TC-RT)

| ID        | Title                                | Level     | Priority | Steps                                                    | Expected                                                 | Automation |
| --------- | ------------------------------------ | --------- | -------- | -------------------------------------------------------- | -------------------------------------------------------- | ---------- |
| TC-RT-001 | Preview shows the site               | e2e       | P0       | Open a project                                           | Preview iframe shows the homepage; address bar shows `/` | todo       |
| TC-RT-002 | Save updates preview                 | e2e       | P0       | Change plugin output text; save                          | Preview shows new text within 2 s (warm)                 | todo       |
| TC-RT-003 | Reload keeps the current URL         | e2e       | P0       | Navigate preview to `/wp-admin/plugins.php`; save a file | Preview reloads on the same URL                          | todo       |
| TC-RT-004 | Sync is debounced                    | unit      | P1       | Fire 10 saves within 200 ms                              | One write to Playground                                  | todo       |
| TC-RT-005 | Sync status indicator                | component | P1       | Fake sync pending → done → failed                        | Status shows Syncing, Synced, Sync failed with retry     | todo       |
| TC-RT-006 | Switch WordPress version keeps files | e2e       | P0       | Create file; switch WP version                           | Reboots; file present; version reported matches          | todo       |
| TC-RT-007 | Switch PHP version                   | e2e       | P0       | Switch PHP to 7.4, then 8.3                              | `PHP_VERSION` matches each time                          | todo       |
| TC-RT-008 | Auto login                           | e2e       | P0       | Open `/wp-admin` in preview                              | Dashboard shows without a login form                     | todo       |
| TC-RT-009 | Boot failure has a way out           | e2e       | P0       | Block the remote URL with Playwright routing             | Error message, Retry button and "Copy logs" visible      | todo       |
