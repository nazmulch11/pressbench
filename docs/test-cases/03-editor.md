# Test cases: Editor (TC-ED)

| ID        | Title                                 | Level | Priority | Steps                                              | Expected                                                                       | Automation |
| --------- | ------------------------------------- | ----- | -------- | -------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| TC-ED-001 | Opens a PHP file with highlighting    | e2e   | P0       | Open `plugin.php`                                  | Monaco shows the file; language is `php`                                       | todo       |
| TC-ED-002 | Language detected from extension      | unit  | P0       | Map `.php .js .jsx .ts .css .scss .html .json .md` | Each maps to the right Monaco language id                                      | todo       |
| TC-ED-003 | Function completion                   | unit  | P0       | Provider at `wp_enq`                               | Suggestions include `wp_enqueue_script` and `wp_enqueue_style` with signatures | todo       |
| TC-ED-004 | Hook completion inside add_action     | unit  | P0       | Provider inside `add_action( 'init`                | Suggestions include `init`, `admin_init`; type is action                       | todo       |
| TC-ED-005 | Hook completion inside add_filter     | unit  | P0       | Provider inside `add_filter( 'the_con`             | Suggests `the_content`; type is filter; no action-only hooks                   | todo       |
| TC-ED-006 | No hook completion outside hook calls | unit  | P1       | Provider inside `echo 'init`                       | No hook suggestions                                                            | todo       |
| TC-ED-007 | Hover shows docs                      | unit  | P0       | Hover `get_option`                                 | Signature, description and developer.wordpress.org link                        | todo       |
| TC-ED-008 | Completion visible in a real browser  | e2e   | P0       | Type `wp_enq`, trigger suggest                     | Suggest widget lists `wp_enqueue_script`                                       | todo       |
| TC-ED-009 | Save shortcut                         | e2e   | P0       | Edit, press Ctrl/Cmd+S                             | Unsaved marker clears; save event fired once                                   | todo       |
| TC-ED-010 | Monaco loads lazily                   | e2e   | P1       | Open `/` with no project, inspect network          | Monaco chunks not requested until an editor opens                              | todo       |
