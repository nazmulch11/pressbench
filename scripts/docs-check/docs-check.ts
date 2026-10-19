/**
 * Docs check: keeps the documentation, the test case files and the tests in step.
 *
 * Checks
 * 1. Relative Markdown links point at files or folders that exist.
 * 2. Test case IDs in docs/test-cases/ are unique.
 * 3. A case whose Automation column names a test file has a test there whose title starts with its ID.
 * 4. Every test title that starts with a test case ID refers to a documented case.
 * 5. Manual cases say `manual` in both the Level and Automation columns.
 * 6. The traceability table in docs/IMPLEMENTATION_PLAN.md matches the case files.
 *
 * Pure functions over an in-memory file map, so the rules can be unit-tested (TC-FND-010).
 */
import { posix } from 'node:path';

/** Repository files: POSIX path relative to the repo root → file content (may be '' for files not read). */
export type RepoFiles = ReadonlyMap<string, string>;

export interface Problem {
  readonly file: string;
  readonly message: string;
}

interface TestCase {
  readonly id: string;
  readonly level: string;
  readonly automation: string;
  readonly file: string;
}

interface CaseFileStats {
  readonly planned: number;
  readonly manual: number;
  readonly automated: number;
}

export const PLAN_PATH = 'docs/IMPLEMENTATION_PLAN.md';
const CASE_FILE = /^docs\/test-cases\/\d{2}-[\w-]+\.md$/;
const CASE_ROW = /^\|\s*(TC-[A-Z]+-\d{3})\s*\|/;
const TEST_FILE = /\.(?:test|spec)\.tsx?$/;
// Skipped, fixme and todo tests do not count as automation, and neither do commented-out tests.
const TEST_TITLE_ID =
  /\b(?:it|test)(?:\.(?:only|fail|concurrent))?\(\s*['"`](TC-[A-Z]+-\d{3})[a-z]?\b/g;
const NON_PATH_AUTOMATION = new Set(['todo', 'manual', 'retired']);
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REFERENCE_LINK = /^ {0,3}\[[^\]]+\]:\s*(\S+)/gm;
const SEPARATOR_CELL = /^:?-+:?$/;
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** Runs every check and returns the problems found, in a stable order. */
export function runDocsCheck(files: RepoFiles): Problem[] {
  const cases = collectCases(files);
  return [
    ...checkLinks(files),
    ...checkTestCases(files, cases),
    ...checkTraceability(files, cases),
  ];
}

function sortedPaths(files: RepoFiles, pattern: RegExp): string[] {
  return [...files.keys()].filter((path) => pattern.test(path)).sort();
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function stripCode(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

/** Resolves a link target to a repo path. A leading `/` means the repository root, as on GitHub. */
function resolveLink(file: string, target: string): string {
  const withoutAnchor = target.split('#')[0] ?? '';
  const resolved = withoutAnchor.startsWith('/')
    ? posix.normalize(withoutAnchor.slice(1) || '.')
    : posix.normalize(posix.join(posix.dirname(file), withoutAnchor));
  return resolved.replace(/\/+$/, '') || '.';
}

function pathExists(files: RepoFiles, path: string): boolean {
  if (path === '.' || files.has(path)) {
    return true;
  }
  const folder = `${path.replace(/\/$/, '')}/`;
  return [...files.keys()].some((key) => key.startsWith(folder));
}

function checkLinks(files: RepoFiles): Problem[] {
  const problems: Problem[] = [];
  for (const file of sortedPaths(files, /\.md$/)) {
    const text = stripCode(files.get(file) ?? '');
    const targets = [...text.matchAll(MARKDOWN_LINK), ...text.matchAll(REFERENCE_LINK)].map(
      (match) => match[1] ?? '',
    );
    for (const target of targets) {
      if (target.startsWith('#') || target.startsWith('<') || URL_SCHEME.test(target)) {
        continue;
      }
      const resolved = resolveLink(file, target);
      if (resolved.startsWith('..') || !pathExists(files, resolved)) {
        problems.push({ file, message: `broken link "${target}"` });
      }
    }
  }
  return problems;
}

function collectCases(files: RepoFiles): TestCase[] {
  const cases: TestCase[] = [];
  for (const file of sortedPaths(files, CASE_FILE)) {
    for (const line of (files.get(file) ?? '').split('\n')) {
      if (!CASE_ROW.test(line)) {
        continue;
      }
      const cells = splitRow(line);
      cases.push({
        id: cells[0] ?? '',
        level: cells[2] ?? '',
        automation: (cells.at(-1) ?? '').replace(/`/g, ''),
        file,
      });
    }
  }
  return cases;
}

function collectTestTitleIds(files: RepoFiles): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const file of sortedPaths(files, TEST_FILE)) {
    const ids = new Set<string>();
    for (const match of stripComments(files.get(file) ?? '').matchAll(TEST_TITLE_ID)) {
      if (match[1] !== undefined) {
        ids.add(match[1]);
      }
    }
    result.set(file, ids);
  }
  return result;
}

function checkTestCases(files: RepoFiles, cases: readonly TestCase[]): Problem[] {
  const problems: Problem[] = [];
  const firstSeen = new Map<string, string>();
  const titleIds = collectTestTitleIds(files);

  for (const testCase of cases) {
    const { id, level, automation, file } = testCase;
    const previous = firstSeen.get(id);
    if (previous !== undefined) {
      problems.push({ file, message: `duplicate test case ID ${id} (first in ${previous})` });
      continue;
    }
    firstSeen.set(id, file);

    if (level === 'manual' && automation !== 'manual' && automation !== 'retired') {
      problems.push({
        file,
        message: `${id} has level "manual" but automation "${automation}"; use "manual"`,
      });
    } else if (automation === 'manual' && level !== 'manual') {
      problems.push({ file, message: `${id} has automation "manual" but level "${level}"` });
    }

    if (NON_PATH_AUTOMATION.has(automation)) {
      continue;
    }
    if (!files.has(automation)) {
      problems.push({ file, message: `${id} points to ${automation}, which does not exist` });
    } else if (!(titleIds.get(automation)?.has(id) ?? false)) {
      problems.push({
        file,
        message: `${id} points to ${automation}, but no test title there starts with ${id}`,
      });
    }
  }

  for (const [file, ids] of titleIds) {
    for (const id of ids) {
      if (!firstSeen.has(id)) {
        problems.push({
          file,
          message: `test title uses ${id}, which is not a documented test case`,
        });
      }
    }
  }
  return problems;
}

function statsFor(cases: readonly TestCase[]): CaseFileStats {
  const active = cases.filter((testCase) => testCase.automation !== 'retired');
  return {
    planned: active.length,
    manual: active.filter((testCase) => testCase.automation === 'manual').length,
    automated: active.filter((testCase) => !NON_PATH_AUTOMATION.has(testCase.automation)).length,
  };
}

/** Parses a count cell such as `12` or `**12**`. Blank or non-numeric cells give NaN. */
function toNumber(cell: string | undefined): number {
  const text = (cell ?? '').replace(/\*/g, '').trim();
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

const STAT_LABELS: readonly (readonly [keyof CaseFileStats, string])[] = [
  ['planned', 'planned'],
  ['manual', 'manual'],
  ['automated', 'automated'],
];

function compareStats(
  where: string,
  expected: CaseFileStats,
  actual: CaseFileStats,
  describe: (label: string, stated: number, real: number) => string,
): Problem[] {
  return STAT_LABELS.filter(([key]) => expected[key] !== actual[key]).map(([key, label]) => ({
    file: PLAN_PATH,
    message: Number.isNaN(expected[key])
      ? `${where} has a blank or non-numeric ${label} count`
      : describe(label, expected[key], actual[key]),
  }));
}

function checkTraceability(files: RepoFiles, cases: readonly TestCase[]): Problem[] {
  const plan = files.get(PLAN_PATH);
  if (plan === undefined) {
    return [{ file: PLAN_PATH, message: 'implementation plan is missing' }];
  }

  const lines = plan.split('\n');
  const start = lines.findIndex((line) => /^## (?:\d+\. )?Traceability\b/.test(line));
  if (start === -1) {
    return [{ file: PLAN_PATH, message: 'no "Traceability" section found' }];
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const rows = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .filter((line) => line.startsWith('|'))
    .map(splitRow)
    .filter((cells) => cells[0] !== 'Area' && !SEPARATOR_CELL.test(cells[0] ?? ''));

  const problems: Problem[] = [];
  const listed = new Set<string>();
  let totalRow: string[] | undefined;

  for (const cells of rows) {
    if ((cells[0] ?? '').includes('Total')) {
      totalRow = cells;
      continue;
    }
    const caseFile = `docs/test-cases/${cells[1] ?? ''}`;
    listed.add(caseFile);
    if (!files.has(caseFile)) {
      problems.push({
        file: PLAN_PATH,
        message: `traceability row points to missing file ${caseFile}`,
      });
      continue;
    }
    const stated = {
      planned: toNumber(cells[3]),
      manual: toNumber(cells[4]),
      automated: toNumber(cells[5]),
    };
    const real = statsFor(cases.filter((testCase) => testCase.file === caseFile));
    problems.push(
      ...compareStats(
        `traceability row ${cells[1] ?? ''}`,
        stated,
        real,
        (label, said, has) =>
          `traceability row ${cells[1] ?? ''} says ${String(said)} ${label}, but the file has ${String(has)}`,
      ),
    );
  }

  if (totalRow !== undefined) {
    const stated = {
      planned: toNumber(totalRow[3]),
      manual: toNumber(totalRow[4]),
      automated: toNumber(totalRow[5]),
    };
    problems.push(
      ...compareStats(
        'traceability total',
        stated,
        statsFor(cases),
        (label, said, has) =>
          `traceability total says ${String(said)} ${label}, but the case files have ${String(has)}`,
      ),
    );
  } else {
    problems.push({ file: PLAN_PATH, message: 'traceability table has no Total row' });
  }

  for (const caseFile of sortedPaths(files, CASE_FILE)) {
    if (!listed.has(caseFile)) {
      problems.push({
        file: PLAN_PATH,
        message: `${caseFile} has no row in the traceability table`,
      });
    }
  }
  return problems;
}
