// @vitest-environment node
import { resolve } from 'node:path';

import { ESLint } from 'eslint';
import { configs as tseslintConfigs } from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const PROBE =
  "import { startPlaygroundWeb } from '@wp-playground/client';\n\nexport { startPlaygroundWeb };\n";

// Type-aware rules need the file to be on disk and in a tsconfig. The probe only exists in memory, so the
// type-checked rules are switched off for this run; `no-restricted-imports` does not need types.
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfig: [{ files: ['**/*.ts', '**/*.tsx'], ...tseslintConfigs.disableTypeChecked }],
});

async function restrictedImportMessages(relativePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(PROBE, { filePath: resolve(ROOT, relativePath) });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'no-restricted-imports')
    .map((message) => message.message);
}

describe('module boundaries', () => {
  it('TC-PG-008a rejects @wp-playground imports outside src/lib/playground', async () => {
    const messages = await restrictedImportMessages('src/features/preview/probe.ts');

    expect(messages).toEqual([
      expect.stringContaining('Only src/lib/playground/ may import WordPress Playground packages.'),
    ]);
  });

  it('TC-PG-008b allows the wrapper and the integration harness to import it', async () => {
    const wrapper = await restrictedImportMessages('src/lib/playground/probe.ts');
    const harness = await restrictedImportMessages('tests/integration/probe.ts');

    expect(wrapper).toEqual([]);
    expect(harness).toEqual([]);
  });
});
