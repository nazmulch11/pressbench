import { describe, expect, it } from 'vitest';

import type { TreeRow } from '@/lib/fs';

import { treeKeyAction } from './tree-keys';

const row = (
  path: string,
  kind: 'file' | 'directory',
  depth: number,
  isExpanded = false,
): TreeRow => ({
  path,
  name: path.slice(path.lastIndexOf('/') + 1),
  kind,
  depth,
  hasChildren: kind === 'directory',
  isExpanded,
  setSize: 1,
  position: 1,
});

const rows: readonly TreeRow[] = [
  row('plugin', 'directory', 0, true),
  row('plugin/inc', 'directory', 1, false),
  row('plugin/plugin.php', 'file', 1),
  row('plugin/readme.txt', 'file', 1),
];

describe('treeKeyAction', () => {
  it('TC-WS-008a maps arrow keys to focus, expand and collapse', () => {
    expect(treeKeyAction({ key: 'ArrowDown' }, rows, 'plugin')).toEqual({
      type: 'focus',
      path: 'plugin/inc',
    });
    expect(treeKeyAction({ key: 'ArrowUp' }, rows, 'plugin')).toBeNull();
    expect(treeKeyAction({ key: 'ArrowDown' }, rows, 'plugin/readme.txt')).toBeNull();
    expect(treeKeyAction({ key: 'ArrowRight' }, rows, 'plugin/inc')).toEqual({
      type: 'expand',
      path: 'plugin/inc',
    });
    expect(treeKeyAction({ key: 'ArrowRight' }, rows, 'plugin')).toEqual({
      type: 'focus',
      path: 'plugin/inc',
    });
    expect(treeKeyAction({ key: 'ArrowRight' }, rows, 'plugin/plugin.php')).toBeNull();
    expect(treeKeyAction({ key: 'ArrowLeft' }, rows, 'plugin')).toEqual({
      type: 'collapse',
      path: 'plugin',
    });
    expect(treeKeyAction({ key: 'ArrowLeft' }, rows, 'plugin/plugin.php')).toEqual({
      type: 'focus',
      path: 'plugin',
    });
    expect(treeKeyAction({ key: 'Home' }, rows, 'plugin/readme.txt')).toEqual({
      type: 'focus',
      path: 'plugin',
    });
    expect(treeKeyAction({ key: 'End' }, rows, 'plugin')).toEqual({
      type: 'focus',
      path: 'plugin/readme.txt',
    });
  });

  it('TC-WS-008b maps Enter, F2, Delete and the context-menu keys to actions', () => {
    expect(treeKeyAction({ key: 'Enter' }, rows, 'plugin/plugin.php')).toEqual({
      type: 'activate',
      path: 'plugin/plugin.php',
    });
    expect(treeKeyAction({ key: 'Enter' }, rows, 'plugin')).toEqual({
      type: 'collapse',
      path: 'plugin',
    });
    expect(treeKeyAction({ key: 'Enter' }, rows, 'plugin/inc')).toEqual({
      type: 'expand',
      path: 'plugin/inc',
    });
    expect(treeKeyAction({ key: 'F2' }, rows, 'plugin/inc')).toEqual({
      type: 'rename',
      path: 'plugin/inc',
    });
    expect(treeKeyAction({ key: 'Delete' }, rows, 'plugin/inc')).toEqual({
      type: 'delete',
      path: 'plugin/inc',
    });
    expect(treeKeyAction({ key: 'F10', shiftKey: true }, rows, 'plugin/inc')).toEqual({
      type: 'menu',
      path: 'plugin/inc',
    });
    expect(treeKeyAction({ key: 'ContextMenu' }, rows, 'plugin/inc')).toEqual({
      type: 'menu',
      path: 'plugin/inc',
    });
    expect(treeKeyAction({ key: 'F10' }, rows, 'plugin/inc')).toBeNull();
    expect(treeKeyAction({ key: 'ArrowLeft', altKey: true }, rows, 'plugin/inc')).toBeNull();
    expect(treeKeyAction({ key: 'Home', ctrlKey: true }, rows, 'plugin/inc')).toBeNull();
    expect(treeKeyAction({ key: 'a' }, rows, 'plugin/inc')).toBeNull();
    expect(treeKeyAction({ key: 'ArrowDown' }, rows, null)).toEqual({
      type: 'focus',
      path: 'plugin',
    });
    expect(treeKeyAction({ key: 'ArrowDown' }, [], null)).toBeNull();
  });
});
