import { describe, expect, it } from 'vitest';

import { runDocsCheck, type RepoFiles } from './docs-check';

// Test titles are built at runtime so the real docs check, which scans this file, does not mistake
// fixture IDs for real test cases.
function titled(id: string): string {
  return `it('${id} does something', () => {});`;
}

function caseTable(rows: readonly string[]): string {
  return [
    '# Test cases: Demo',
    '',
    '| ID | Title | Level | Priority | Steps | Expected | Automation |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function plan(planned: number, manual: number, automated: number): string {
  return [
    '# Plan',
    '',
    '## 6. Traceability',
    '',
    '| Area | Test case file | Prefix | Cases planned | Manual by design | Automated so far |',
    '| --- | --- | --- | --- | --- | --- |',
    `| Demo | 00-demo.md | TC-DEMO | ${String(planned)} | ${String(manual)} | ${String(automated)} |`,
    `| **Total** | | | **${String(planned)}** | **${String(manual)}** | **${String(automated)}** |`,
    '',
    '## 7. Risks',
    '',
  ].join('\n');
}

function cleanRepo(): Map<string, string> {
  const id1 = ['TC', 'DEMO', '001'].join('-');
  const id2 = ['TC', 'DEMO', '002'].join('-');
  return new Map([
    ['README.md', 'See [the plan](docs/IMPLEMENTATION_PLAN.md) and [cases](docs/test-cases/).'],
    ['docs/IMPLEMENTATION_PLAN.md', plan(2, 1, 1)],
    [
      'docs/test-cases/00-demo.md',
      caseTable([
        `| ${id1} | Works | unit | P0 | Do it | It works | \`src/demo.test.ts\` |`,
        `| ${id2} | By hand | manual | P1 | Look | Fine | manual |`,
      ]),
    ],
    ['src/demo.test.ts', titled(`${id1}a`)],
  ]);
}

function messages(files: RepoFiles): string[] {
  return runDocsCheck(files).map((problem) => `${problem.file}: ${problem.message}`);
}

describe('docs check', () => {
  it('TC-FND-010 reports nothing for a consistent repository', () => {
    const files = cleanRepo();

    expect(messages(files)).toEqual([]);
  });

  it('TC-FND-010a reports broken relative links', () => {
    const files = cleanRepo();
    files.set(
      'README.md',
      'Read [missing](docs/MISSING.md) and [web](https://example.com) and [top](#top).',
    );

    expect(messages(files)).toEqual(['README.md: broken link "docs/MISSING.md"']);
  });

  it('TC-FND-010b ignores links inside code', () => {
    const files = cleanRepo();
    files.set('README.md', 'Inline `[x](nope.md)` and\n\n```md\n[y](also-nope.md)\n```\n');

    expect(messages(files)).toEqual([]);
  });

  it('TC-FND-010c reports duplicate test case IDs', () => {
    const files = cleanRepo();
    const id = ['TC', 'DEMO', '001'].join('-');
    files.set(
      'docs/test-cases/01-more.md',
      caseTable([`| ${id} | Again | unit | P0 | x | y | todo |`]),
    );

    expect(messages(files)).toContain(
      `docs/test-cases/01-more.md: duplicate test case ID ${id} (first in docs/test-cases/00-demo.md)`,
    );
  });

  it('TC-FND-010d reports an automation path with no matching test', () => {
    const files = cleanRepo();
    files.set('src/demo.test.ts', titled(['TC', 'DEMO', '999'].join('-')));

    const found = messages(files);

    expect(found).toContain(
      'docs/test-cases/00-demo.md: TC-DEMO-001 points to src/demo.test.ts, but no test title there starts with TC-DEMO-001',
    );
    expect(found).toContain(
      'src/demo.test.ts: test title uses TC-DEMO-999, which is not a documented test case',
    );
  });

  it('TC-FND-010e reports an automation path that does not exist', () => {
    const files = cleanRepo();
    files.delete('src/demo.test.ts');

    expect(messages(files)).toContain(
      'docs/test-cases/00-demo.md: TC-DEMO-001 points to src/demo.test.ts, which does not exist',
    );
  });

  it('TC-FND-010f reports manual cases whose automation column disagrees', () => {
    const files = cleanRepo();
    const id = ['TC', 'DEMO', '002'].join('-');
    files.set(
      'docs/test-cases/00-demo.md',
      (files.get('docs/test-cases/00-demo.md') ?? '').replace(
        `| ${id} | By hand | manual | P1 | Look | Fine | manual |`,
        `| ${id} | By hand | manual | P1 | Look | Fine | todo |`,
      ),
    );

    expect(messages(files)).toContain(
      'docs/test-cases/00-demo.md: TC-DEMO-002 has level "manual" but automation "todo"; use "manual"',
    );
  });

  it('TC-FND-010g reports traceability counts that do not match the case files', () => {
    const files = cleanRepo();
    files.set('docs/IMPLEMENTATION_PLAN.md', plan(3, 1, 0));

    expect(messages(files)).toEqual([
      'docs/IMPLEMENTATION_PLAN.md: traceability row 00-demo.md says 3 planned, but the file has 2',
      'docs/IMPLEMENTATION_PLAN.md: traceability row 00-demo.md says 0 automated, but the file has 1',
      'docs/IMPLEMENTATION_PLAN.md: traceability total says 3 planned, but the case files have 2',
      'docs/IMPLEMENTATION_PLAN.md: traceability total says 0 automated, but the case files have 1',
    ]);
  });

  it('TC-FND-010h reports case files missing from the traceability table', () => {
    const files = cleanRepo();
    files.set('docs/test-cases/01-more.md', caseTable([]));

    expect(messages(files)).toContain(
      'docs/IMPLEMENTATION_PLAN.md: docs/test-cases/01-more.md has no row in the traceability table',
    );
  });

  it('TC-FND-010i accepts ID cells padded by table alignment', () => {
    const files = cleanRepo();
    files.set(
      'docs/test-cases/00-demo.md',
      (files.get('docs/test-cases/00-demo.md') ?? '').replace(
        /^\| (TC-DEMO-\d{3}) \|/gm,
        '|  $1   |',
      ),
    );

    expect(messages(files)).toEqual([]);
  });

  it('TC-FND-010j does not count skipped or commented-out tests as automation', () => {
    const id = ['TC', 'DEMO', '001'].join('-');
    const variants = [
      `it.skip('${id}a skipped', () => {});`,
      `test.fixme('${id}a not ready', () => {});`,
      `it.todo('${id}a later');`,
      `// ${titled(id)}`,
      `/*\n${titled(id)}\n*/`,
    ];

    const expected = `docs/test-cases/00-demo.md: ${id} points to src/demo.test.ts, but no test title there starts with ${id}`;

    const flagged = variants.map((source) => {
      const files = cleanRepo();
      files.set('src/demo.test.ts', source);
      return messages(files).includes(expected);
    });

    expect(flagged).toEqual(variants.map(() => true));
  });

  it('TC-FND-010k resolves root-relative and folder links', () => {
    const files = cleanRepo();
    files.set('docs/guide.md', '[plan](/docs/IMPLEMENTATION_PLAN.md), [home](../) and [here](./).');

    expect(messages(files)).toEqual([]);
  });

  it('TC-FND-010l checks reference-style links and ignores ~~~ fences', () => {
    const files = cleanRepo();
    files.set(
      'docs/guide.md',
      'See [the plan][plan].\n\n[plan]: missing.md\n\n~~~\n[x](nope.md)\n~~~\n',
    );

    expect(messages(files)).toEqual(['docs/guide.md: broken link "missing.md"']);
  });

  it('TC-FND-010m reads aligned tables and reports blank counts and a missing total', () => {
    const files = cleanRepo();
    const aligned = (files.get('docs/IMPLEMENTATION_PLAN.md') ?? '').replace(
      '| --- | --- | --- | --- | --- | --- |',
      '| :--- | :--- | :---: | ---: | ---: | ---: |',
    );
    files.set('docs/IMPLEMENTATION_PLAN.md', aligned);
    const alignedProblems = messages(files);

    files.set(
      'docs/IMPLEMENTATION_PLAN.md',
      aligned
        .replace(
          '| Demo | 00-demo.md | TC-DEMO | 2 | 1 | 1 |',
          '| Demo | 00-demo.md | TC-DEMO | 2 |  | 1 |',
        )
        .replace(/^\| \*\*Total\*\*.*$/m, ''),
    );

    expect(alignedProblems).toEqual([]);
    expect(messages(files)).toEqual([
      'docs/IMPLEMENTATION_PLAN.md: traceability row 00-demo.md has a blank or non-numeric manual count',
      'docs/IMPLEMENTATION_PLAN.md: traceability table has no Total row',
    ]);
  });
});
