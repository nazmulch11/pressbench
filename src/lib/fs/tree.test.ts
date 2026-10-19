import { describe, expect, it } from 'vitest';

import { createProjectFs } from './project-fs';
import { buildTree, flattenTree } from './tree';

describe('tree model', () => {
  it('TC-WS-014 sorts folders first and names naturally, case-insensitively', () => {
    const fs = createProjectFs({
      files: {
        'b.php': '',
        'A.php': '',
        'inc/z.php': '',
        'file10.php': '',
        'file2.php': '',
      },
      directories: ['inc', 'Zeta'],
    });

    const tree = buildTree(fs.entries());

    expect(tree.map((node) => node.name)).toEqual([
      'inc',
      'Zeta',
      'A.php',
      'b.php',
      'file2.php',
      'file10.php',
    ]);
    expect(tree[0]?.children.map((node) => node.path)).toEqual(['inc/z.php']);
  });

  it('TC-WS-014a flattens only the expanded branches with depth and expansion state', () => {
    const fs = createProjectFs({
      files: { 'a/one.php': '', 'a/sub/two.php': '', 'b/three.php': '' },
    });
    const tree = buildTree(fs.entries());

    const rows = flattenTree(tree, new Set(['a']));

    expect(rows.map((row) => [row.path, row.depth, row.isExpanded])).toEqual([
      ['a', 0, true],
      ['a/sub', 1, false],
      ['a/one.php', 1, false],
      ['b', 0, false],
    ]);
    expect(rows[0]?.hasChildren).toBe(true);
    expect(rows[2]?.hasChildren).toBe(false);
    expect(rows.map((row) => [row.position, row.setSize])).toEqual([
      [1, 2],
      [1, 2],
      [2, 2],
      [2, 2],
    ]);
  });
});
