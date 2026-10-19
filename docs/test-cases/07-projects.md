# Test cases: Projects (TC-PRJ)

| ID         | Title                                   | Level     | Priority | Steps                                                    | Expected                                                    | Automation |
| ---------- | --------------------------------------- | --------- | -------- | -------------------------------------------------------- | ----------------------------------------------------------- | ---------- |
| TC-PRJ-001 | Create and list projects                | e2e       | P0       | Create two projects; open project list                   | Both listed, newest first                                   | todo       |
| TC-PRJ-002 | Project survives reload                 | e2e       | P0       | Edit file; save; reload browser                          | Same file content; same open tabs                           | todo       |
| TC-PRJ-003 | Rename and duplicate                    | component | P1       | Rename; duplicate                                        | Names update; duplicate has identical files                 | todo       |
| TC-PRJ-004 | Delete asks first                       | e2e       | P0       | Delete project                                           | Confirm dialog; on confirm project and its storage are gone | todo       |
| TC-PRJ-005 | Import plugin zip                       | e2e       | P0       | Upload fixture `hello-dolly.zip`                         | Detected as plugin; files in tree; preview can activate it  | todo       |
| TC-PRJ-006 | Import theme zip                        | e2e       | P0       | Upload fixture theme zip                                 | Detected as theme                                           | todo       |
| TC-PRJ-007 | Reject unsafe zip paths                 | unit      | P0       | Import zip with `../evil.php` and absolute paths         | Import refused with a clear reason; nothing written         | todo       |
| TC-PRJ-008 | Export zip structure                    | unit      | P0       | Export project `my-plugin`                               | Zip has one top-level `my-plugin/` folder with all files    | todo       |
| TC-PRJ-009 | Round trip is lossless                  | e2e       | P0       | Import → export → import                                 | File hashes identical                                       | todo       |
| TC-PRJ-010 | Exported zip installs on real WordPress | manual    | P0       | Upload exported zip via Plugins → Add New on a real site | Installs and activates                                      | manual     |
