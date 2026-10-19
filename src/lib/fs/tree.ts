import { dirname } from './paths';
import { compareEntries } from './project-fs';
import type { FsEntry, FsEntryKind } from './types';

/** A node of the nested tree built from flat entries. */
export interface TreeNode {
  readonly path: string;
  readonly name: string;
  readonly kind: FsEntryKind;
  readonly children: readonly TreeNode[];
}

/** One visible row of the tree, in display order. */
export interface TreeRow {
  readonly path: string;
  readonly name: string;
  readonly kind: FsEntryKind;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
  /** Number of siblings at this level, for `aria-setsize`. */
  readonly setSize: number;
  /** 1-based index among the siblings, for `aria-posinset`. */
  readonly position: number;
}

interface MutableNode {
  path: string;
  name: string;
  kind: FsEntryKind;
  children: MutableNode[];
}

/** Nests flat entries into a tree, folders first and names in natural order at every level. */
export function buildTree(entries: readonly FsEntry[]): readonly TreeNode[] {
  const nodes = new Map<string, MutableNode>();
  const roots: MutableNode[] = [];
  for (const item of entries) {
    const node: MutableNode = { path: item.path, name: item.name, kind: item.kind, children: [] };
    nodes.set(item.path, node);
    const parent = nodes.get(dirname(item.path));
    if (parent === undefined || item.path.lastIndexOf('/') === -1) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }
  const sortDeep = (list: MutableNode[]): void => {
    list.sort(compareEntries);
    for (const node of list) {
      sortDeep(node.children);
    }
  };
  sortDeep(roots);
  return roots;
}

/** Lists the rows a tree shows when the folders in `expanded` are open. */
export function flattenTree(
  nodes: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  depth = 0,
): readonly TreeRow[] {
  const rows: TreeRow[] = [];
  nodes.forEach((node, index) => {
    const isDirectory = node.kind === 'directory';
    const isExpanded = isDirectory && expanded.has(node.path);
    rows.push({
      path: node.path,
      name: node.name,
      kind: node.kind,
      depth,
      hasChildren: isDirectory,
      isExpanded,
      setSize: nodes.length,
      position: index + 1,
    });
    if (isExpanded) {
      rows.push(...flattenTree(node.children, expanded, depth + 1));
    }
  });
  return rows;
}
