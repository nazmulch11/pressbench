// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { HOOKS_PACKAGE, STUBS_SOURCE, wordpressVersionFromReadme } from './sources';
import type { WordPressFunctionsFile, WordPressHooksFile } from '../../src/lib/wp-data/types';

function readData(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../src/data/${name}`, import.meta.url), 'utf8'));
}

const hooksPackage = JSON.parse(
  readFileSync(
    new URL(`../../node_modules/${HOOKS_PACKAGE}/package.json`, import.meta.url),
    'utf8',
  ),
) as { version: string };

describe('generated WordPress data', () => {
  it('TC-ED-017 records the source version of each file and matches the pinned sources', () => {
    const functions = readData('wp-functions.json') as WordPressFunctionsFile;
    const hooks = readData('wp-hooks.json') as WordPressHooksFile;

    expect(functions.source).toEqual(STUBS_SOURCE);
    expect(hooks.source).toMatchObject({
      name: HOOKS_PACKAGE,
      version: hooksPackage.version,
      url: expect.stringContaining(hooksPackage.version) as string,
      licence: 'GPL-3.0-or-later',
    });
    expect(hooks.source.wordpress).toMatch(/^\d+\.\d+/);

    const names = new Set(functions.functions.map((fn) => fn.name));
    expect(functions.functions.length).toBeGreaterThan(3000);
    expect(names.has('wp_enqueue_script')).toBe(true);
    expect(names.has('get_option')).toBe(true);
    expect(names.has('add_action')).toBe(true);
    expect(functions.functions.every((fn) => fn.signature.startsWith('('))).toBe(true);

    const hookKeys = new Set(hooks.hooks.map((hook) => `${hook.type}:${hook.name}`));
    expect(hooks.hooks.length).toBeGreaterThan(2000);
    expect(hookKeys.has('action:init')).toBe(true);
    expect(hookKeys.has('action:admin_init')).toBe(true);
    expect(hookKeys.has('filter:the_content')).toBe(true);
    expect(hookKeys.size).toBe(hooks.hooks.length);
  });

  it('TC-ED-017a reads the WordPress version out of the hooks package readme', () => {
    expect(wordpressVersionFromReadme('Intro.\n\nLast updated for WordPress 7.1.\n\n## Use')).toBe(
      '7.1',
    );
    expect(wordpressVersionFromReadme('Last updated for WordPress 6.8.2\n')).toBe('6.8.2');
    expect(wordpressVersionFromReadme('nothing here')).toBeUndefined();
  });
});
