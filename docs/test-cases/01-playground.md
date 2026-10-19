# Test cases: Playground integration (TC-PG)

All `e2e` cases run in Chromium, Firefox and WebKit, 3 times each.

| ID        | Title                                      | Level       | Priority | Steps                                                                          | Expected                                                                       | Automation |
| --------- | ------------------------------------------ | ----------- | -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------- |
| TC-PG-001 | Boots WordPress                            | e2e         | P0       | Start the service; wait for ready                                              | Ready within 30 s (cold); iframe shows the default theme homepage              | todo       |
| TC-PG-002 | Writes and activates a plugin              | e2e         | P0       | Write `hello.php` plugin with an `admin_notices` hook; activate; open wp-admin | Notice text visible in wp-admin                                                | todo       |
| TC-PG-003 | Runs PHP and returns output                | integration | P0       | `run('<?php echo 2+2;')`                                                       | Output is `4`, exit code 0                                                     | todo       |
| TC-PG-004 | PHP errors are returned, not thrown away   | integration | P0       | Run PHP that calls an undefined function                                       | Result contains the fatal error message and line                               | todo       |
| TC-PG-005 | Boots requested versions                   | e2e         | P0       | Boot with WordPress `6.x` and PHP `8.3`                                        | `get_bloginfo('version')` and `PHP_VERSION` match                              | todo       |
| TC-PG-006 | Files persist across reload (OPFS)         | e2e         | P0       | Write a file; reload the page; boot again                                      | File exists with identical content                                             | todo       |
| TC-PG-007 | Boot failure is reported                   | component   | P0       | Fake service rejects on boot                                                   | Error state with message and Retry button                                      | todo       |
| TC-PG-008 | Only the wrapper imports the client        | unit        | P1       | ESLint `no-restricted-imports` rule on the codebase                            | Any import of `@wp-playground/client` outside `src/lib/playground/` fails lint | todo       |
| TC-PG-009 | Fake service matches real service contract | unit        | P1       | Run the shared contract test suite against the fake                            | All contract tests pass (the same suite runs against the real service in e2e)  | todo       |
