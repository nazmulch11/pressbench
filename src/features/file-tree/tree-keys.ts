import { dirname, type TreeRow } from '@/lib/fs';

/** What a key press on the tree should do. */
export type TreeKeyAction =
  | { readonly type: 'focus'; readonly path: string }
  | { readonly type: 'expand'; readonly path: string }
  | { readonly type: 'collapse'; readonly path: string }
  | { readonly type: 'activate'; readonly path: string }
  | { readonly type: 'rename'; readonly path: string }
  | { readonly type: 'delete'; readonly path: string }
  | { readonly type: 'menu'; readonly path: string };

export interface TreeKey {
  readonly key: string;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
}

/**
 * The WAI-ARIA tree keyboard pattern over the visible rows: arrows move and open or close folders, Enter opens,
 * F2 renames, Delete asks to delete, Shift+F10 or the ContextMenu key opens the menu.
 */
export function treeKeyAction(
  key: TreeKey,
  rows: readonly TreeRow[],
  focused: string | null,
): TreeKeyAction | null {
  if (key.ctrlKey === true || key.altKey === true || key.metaKey === true) {
    return null;
  }
  const index = rows.findIndex((row) => row.path === focused);
  const current = rows[index];
  const focusRow = (row: TreeRow | undefined): TreeKeyAction | null =>
    row === undefined ? null : { type: 'focus', path: row.path };

  if (current === undefined) {
    return key.key === 'ArrowDown' || key.key === 'Home' || key.key === 'End'
      ? focusRow(key.key === 'End' ? rows.at(-1) : rows[0])
      : null;
  }
  switch (key.key) {
    case 'ArrowDown':
      return focusRow(rows[index + 1]);
    case 'ArrowUp':
      return focusRow(rows[index - 1]);
    case 'Home':
      return focusRow(rows[0]);
    case 'End':
      return focusRow(rows.at(-1));
    case 'ArrowRight':
      if (!current.hasChildren) {
        return null;
      }
      return current.isExpanded
        ? focusRow(rows[index + 1])
        : { type: 'expand', path: current.path };
    case 'ArrowLeft':
      if (current.isExpanded) {
        return { type: 'collapse', path: current.path };
      }
      return focusRow(rows.find((row) => row.path === dirname(current.path)));
    case 'Enter':
      if (!current.hasChildren) {
        return { type: 'activate', path: current.path };
      }
      return { type: current.isExpanded ? 'collapse' : 'expand', path: current.path };
    case 'F2':
      return { type: 'rename', path: current.path };
    case 'Delete':
      return { type: 'delete', path: current.path };
    case 'ContextMenu':
      return { type: 'menu', path: current.path };
    case 'F10':
      return key.shiftKey === true ? { type: 'menu', path: current.path } : null;
    default:
      return null;
  }
}
