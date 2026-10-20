/** Folders the test tools write into. The dev server must never watch them (TC-FND-011). */
export const GENERATED_REPORT_DIRS = [
  'coverage',
  'playwright-report',
  'test-results',
  'blob-report',
];

/**
 * Watch-ignore patterns for the report folders under `root`, written with forward slashes: the watcher's glob
 * matcher reads a backslash as an escape, so a Windows path would never match.
 */
export function reportIgnorePatterns(root: string): string[] {
  const base = root.replaceAll('\\', '/').replace(/\/+$/, '');
  return GENERATED_REPORT_DIRS.flatMap((dir) => [`${base}/${dir}`, `${base}/${dir}/**`]);
}
