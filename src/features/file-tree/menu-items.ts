import type { MenuItem } from '@/ui/Menu';

/** What the context menu was opened on: a row, or the empty area (the project root). */
export interface MenuTarget {
  readonly path: string;
  readonly kind: 'file' | 'directory' | 'root';
}

export interface MenuActions {
  open: (path: string) => void;
  newFile: (parent: string) => void;
  newFolder: (parent: string) => void;
  rename: (path: string) => void;
  remove: (path: string) => void;
  move: (path: string) => void;
}

/** The items for a target, in display order. */
export function treeMenuItems(target: MenuTarget, actions: MenuActions): readonly MenuItem[] {
  const create: MenuItem[] = [
    {
      id: 'new-file',
      label: 'New file',
      onSelect: () => {
        actions.newFile(target.path);
      },
    },
    {
      id: 'new-folder',
      label: 'New folder',
      onSelect: () => {
        actions.newFolder(target.path);
      },
    },
  ];
  if (target.kind === 'root') {
    return create;
  }
  const edit: MenuItem[] = [
    {
      id: 'rename',
      label: 'Rename',
      shortcut: 'F2',
      onSelect: () => {
        actions.rename(target.path);
      },
    },
    {
      id: 'move',
      label: 'Move to…',
      onSelect: () => {
        actions.move(target.path);
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      shortcut: 'Del',
      onSelect: () => {
        actions.remove(target.path);
      },
    },
  ];
  if (target.kind === 'directory') {
    return [...create, ...edit];
  }
  return [
    {
      id: 'open',
      label: 'Open',
      shortcut: 'Enter',
      onSelect: () => {
        actions.open(target.path);
      },
    },
    ...edit,
  ];
}
