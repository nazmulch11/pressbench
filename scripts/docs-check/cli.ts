/**
 * `npm run docs:check`: runs the docs check over the repository and exits non-zero on any problem.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { runDocsCheck } from './docs-check';

const SKIPPED_FOLDERS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  'blob-report',
]);
const READ_CONTENT = /\.(?:md|test\.tsx?|spec\.tsx?)$/;

function collectFiles(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (folder: string): void => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const fullPath = join(folder, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.has(entry.name)) {
          walk(fullPath);
        }
        continue;
      }
      const path = relative(root, fullPath).split(sep).join('/');
      files.set(path, READ_CONTENT.test(path) ? readFileSync(fullPath, 'utf8') : '');
    }
  };
  walk(root);
  return files;
}

const files = collectFiles(process.cwd());
const problems = runDocsCheck(files);

if (problems.length === 0) {
  const markdownCount = [...files.keys()].filter((path) => path.endsWith('.md')).length;
  console.log(`Docs check passed (${String(markdownCount)} Markdown files).`);
} else {
  for (const problem of problems) {
    console.error(`${problem.file}: ${problem.message}`);
  }
  console.error(`\nDocs check failed with ${String(problems.length)} problem(s).`);
  process.exitCode = 1;
}
