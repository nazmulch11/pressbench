import { describe, expect, it, vi } from 'vitest';

import { createProjectFs } from './project-fs';
import type { FsChange } from './types';

function seeded() {
  return createProjectFs({
    files: {
      'plugin/plugin.php': '<?php',
      'plugin/readme.txt': 'readme',
      'plugin/inc/class-a.php': 'class A {}',
    },
    directories: ['plugin/empty'],
  });
}

describe('ProjectFs', () => {
  it('TC-WS-013a writes a nested path, creating its parents, and reads it back', () => {
    const fs = createProjectFs();

    const written = fs.write('a/b/c.txt', 'hello');

    expect(written).toEqual({ ok: true, value: undefined });
    expect(fs.read('a/b/c.txt')).toEqual({ ok: true, value: 'hello' });
    expect(fs.stat('a')).toBe('directory');
    expect(fs.stat('a/b')).toBe('directory');
    expect(fs.stat('a/b/c.txt')).toBe('file');
    expect(fs.stat('missing')).toBeUndefined();
  });

  it('TC-WS-013b lists direct children sorted folders first, then all entries by path', () => {
    const fs = seeded();

    expect(fs.list('plugin').map((entry) => entry.path)).toEqual([
      'plugin/empty',
      'plugin/inc',
      'plugin/plugin.php',
      'plugin/readme.txt',
    ]);
    expect(fs.list('').map((entry) => entry.path)).toEqual(['plugin']);
    expect(fs.entries().map((entry) => `${entry.kind}:${entry.path}`)).toEqual([
      'directory:plugin',
      'directory:plugin/empty',
      'directory:plugin/inc',
      'file:plugin/inc/class-a.php',
      'file:plugin/plugin.php',
      'file:plugin/readme.txt',
    ]);
  });

  it('TC-WS-013c renames a folder and moves its children', () => {
    const fs = seeded();

    const renamed = fs.rename('plugin/inc', 'plugin/includes');

    expect(renamed).toEqual({ ok: true, value: undefined });
    expect(fs.stat('plugin/inc')).toBeUndefined();
    expect(fs.read('plugin/includes/class-a.php')).toEqual({ ok: true, value: 'class A {}' });
  });

  it('TC-WS-013d removes a folder with everything inside it', () => {
    const fs = seeded();

    const removed = fs.remove('plugin');

    expect(removed).toEqual({ ok: true, value: undefined });
    expect(fs.entries()).toEqual([]);
  });

  it('TC-WS-013e returns errors as results instead of throwing', () => {
    const fs = seeded();

    expect(fs.read('plugin/nope.php')).toMatchObject({ ok: false, error: { kind: 'not-found' } });
    expect(fs.read('plugin/inc')).toMatchObject({ ok: false, error: { kind: 'is-directory' } });
    expect(fs.write('plugin/inc', 'x')).toMatchObject({
      ok: false,
      error: { kind: 'is-directory' },
    });
    expect(fs.write('plugin/plugin.php/x.php', 'x')).toMatchObject({
      ok: false,
      error: { kind: 'not-a-directory' },
    });
    expect(fs.write('../x.php', 'x')).toMatchObject({ ok: false, error: { kind: 'invalid-path' } });
    expect(fs.mkdir('plugin/inc')).toMatchObject({ ok: false, error: { kind: 'exists' } });
    expect(fs.mkdir('plugin/plugin.php')).toMatchObject({ ok: false, error: { kind: 'exists' } });
    expect(fs.remove('nope')).toMatchObject({ ok: false, error: { kind: 'not-found' } });
    expect(fs.rename('nope', 'x')).toMatchObject({ ok: false, error: { kind: 'not-found' } });
    expect(fs.rename('plugin/readme.txt', 'plugin/plugin.php')).toMatchObject({
      ok: false,
      error: { kind: 'exists' },
    });
    expect(fs.rename('plugin', 'plugin/inc/plugin')).toMatchObject({
      ok: false,
      error: { kind: 'invalid-move' },
    });
    expect(fs.rename('plugin/inc', 'plugin/inc')).toMatchObject({
      ok: false,
      error: { kind: 'invalid-move' },
    });
    expect(fs.rename('plugin/readme.txt', 'other/readme.txt')).toMatchObject({
      ok: false,
      error: { kind: 'not-found' },
    });
    expect(fs.list('plugin/plugin.php')).toEqual([]);
  });

  it('TC-WS-013f emits one change event per successful change and none for failures', () => {
    const fs = seeded();
    const listener = vi.fn<(change: FsChange) => void>();
    fs.onChange(listener);

    fs.write('plugin/new.php', 'n');
    fs.write('plugin/new.php', 'n2');
    fs.mkdir('plugin/dir');
    fs.rename('plugin/new.php', 'plugin/dir/new.php');
    fs.remove('plugin/dir');
    fs.remove('nope');

    expect(listener.mock.calls.map(([change]) => change)).toEqual([
      { type: 'write', path: 'plugin/new.php', created: true },
      { type: 'write', path: 'plugin/new.php', created: false },
      { type: 'mkdir', path: 'plugin/dir' },
      { type: 'rename', from: 'plugin/new.php', to: 'plugin/dir/new.php', kind: 'file' },
      { type: 'remove', path: 'plugin/dir', kind: 'directory' },
    ]);
  });

  it('TC-WS-013g stops notifying after unsubscribe', () => {
    const fs = createProjectFs();
    const listener = vi.fn();
    const unsubscribe = fs.onChange(listener);

    unsubscribe();
    fs.write('a.txt', 'a');

    expect(listener).not.toHaveBeenCalled();
  });

  it('TC-WS-013h creates the parents of seeded files and ignores a blank root', () => {
    const fs = createProjectFs({ files: { 'a/b/c.txt': 'c' }, directories: [''] });

    expect(fs.entries().map((entry) => entry.path)).toEqual(['a', 'a/b', 'a/b/c.txt']);
    expect(fs.exists('a/b')).toBe(true);
    expect(fs.exists('')).toBe(true);
    expect(fs.mkdir('')).toMatchObject({ ok: false, error: { kind: 'exists' } });
  });
});
