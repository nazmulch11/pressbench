import { describe, expect, it } from 'vitest';

import { basename, dirname, isAncestor, joinPath, normalizePath, validateName } from './paths';

describe('validateName', () => {
  it('TC-WS-006 rejects invalid names with a reason', () => {
    const cases: readonly [string, RegExp][] = [
      ['', /empty/],
      ['a/b', /slash/],
      ['a\\b', /slash/],
      ['.', /dot/],
      ['..', /dot/],
      ['CON', /reserved/],
      ['con.php', /reserved/],
      ['a\0b', /invalid characters/],
      ['a<b', /invalid characters/],
      ['a.', /end with/],
      ['a ', /end with/],
      ['x'.repeat(256), /too long/],
    ];

    const results = cases.map(([name]) => validateName(name));

    results.forEach((result, index) => {
      const [name, reason] = cases[index] ?? ['', /never/];
      expect(result.ok, `expected ${JSON.stringify(name)} to be rejected`).toBe(false);
      expect(!result.ok && result.error).toMatch(reason);
    });
  });

  it('TC-WS-006a accepts ordinary names, dot-files and 255 characters', () => {
    const names = ['readme.txt', '.htaccess', 'my-plugin', 'class-my_plugin.php', 'x'.repeat(255)];

    const results = names.map((name) => validateName(name));

    expect(results).toEqual(names.map((name) => ({ ok: true, value: name })));
  });
});

describe('normalizePath', () => {
  it('TC-WS-006b accepts project-relative paths and rejects escapes', () => {
    expect(normalizePath('a/b.php')).toEqual({ ok: true, value: 'a/b.php' });
    expect(normalizePath('')).toEqual({ ok: true, value: '' });
    expect(normalizePath('/a/b.php').ok).toBe(false);
    expect(normalizePath('a/../b.php').ok).toBe(false);
    expect(normalizePath('a//b.php').ok).toBe(false);
    expect(normalizePath('a/./b.php').ok).toBe(false);
    expect(normalizePath('a/b.php/').ok).toBe(false);
    expect(normalizePath('a/CON/b.php').ok).toBe(false);
  });
});

describe('path helpers', () => {
  it('TC-WS-006c splits and joins paths', () => {
    expect(dirname('a/b/c.php')).toBe('a/b');
    expect(dirname('c.php')).toBe('');
    expect(basename('a/b/c.php')).toBe('c.php');
    expect(basename('')).toBe('');
    expect(joinPath('', 'a.php')).toBe('a.php');
    expect(joinPath('a/b', 'c.php')).toBe('a/b/c.php');
    expect(isAncestor('a', 'a/b/c.php')).toBe(true);
    expect(isAncestor('a', 'ab/c.php')).toBe(false);
    expect(isAncestor('a', 'a')).toBe(false);
    expect(isAncestor('', 'a')).toBe(true);
  });
});
