import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { basename, buildTree, flattenTree, type FsError } from '@/lib/fs';
import { createLogger } from '@/lib/logger';
import type { Result } from '@/lib/result';
import { useWorkspaceStore, useWorkspaceStoreApi } from '@/stores';
import { Menu } from '@/ui/Menu';

import styles from './FileTree.module.css';
import { treeMenuItems, type MenuTarget } from './menu-items';
import { menuPositionFor, nextFocusAfterDelete, remapExpanded } from './tree-helpers';
import { treeKeyAction } from './tree-keys';
import { DeleteDialog, MoveDialog } from './TreeDialogs';
import { TreeRows, type TreeEditing } from './TreeRows';
import { useTreeDrag } from './useTreeDrag';

const log = createLogger('file-tree');

interface OpenMenu {
  readonly target: MenuTarget;
  readonly position: { x: number; y: number };
}

/**
 * The project file tree: open files, create, rename, move (drag or dialog) and delete, by mouse and keyboard.
 * State that other features need (open tabs, requests from the palette) goes through the workspace store.
 */
export function FileTree(): React.JSX.Element {
  const api = useWorkspaceStoreApi();
  const entries = useWorkspaceStore((state) => state.entries);
  const activeTab = useWorkspaceStore((state) => state.activeTab);
  const treeRef = useRef<HTMLUListElement>(null);

  const tree = useMemo(() => buildTree(entries), [entries]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(entries.filter((entry) => entry.kind === 'directory').map((entry) => entry.path)),
  );
  const rows = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [editing, setEditing] = useState<TreeEditing | null>(null);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  /** Row to focus after the next commit (set from event handlers, consumed by the effect below). */
  const pendingFocus = useRef<string | null>(null);

  const visibleFocus = rows.some((row) => row.path === focusedPath)
    ? focusedPath
    : (rows[0]?.path ?? null);

  const focusItem = useCallback((path: string | null) => {
    setFocusedPath(path);
    pendingFocus.current = path;
  }, []);

  useEffect(() => {
    const path = pendingFocus.current;
    // An open editor or dialog owns the focus; the row gets it back once they close.
    if (path === null || editing !== null || deleting !== null || moving !== null) {
      return;
    }
    pendingFocus.current = null;
    treeRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)?.focus();
  });

  const expand = useCallback((path: string) => {
    setExpanded((current) => (current.has(path) ? current : new Set([...current, path])));
  }, []);

  const startCreate = useCallback(
    (kind: 'file' | 'directory', parent: string) => {
      if (parent !== '') {
        expand(parent);
      }
      setEditing({ mode: 'create', kind, parent });
    },
    [expand],
  );

  // Requests from the palette and shortcuts arrive through the store; react to each new one once.
  useEffect(
    () =>
      api.subscribe((state, previous) => {
        const request = state.treeRequest;
        if (request === null || request === previous.treeRequest) {
          return;
        }
        if (request.kind === 'rename') {
          setEditing({ mode: 'rename', path: request.path });
        } else {
          startCreate(request.kind === 'new-file' ? 'file' : 'directory', request.parent);
        }
        state.clearTreeRequest();
      }),
    [api, startCreate],
  );

  const moveTo = useCallback(
    (path: string, folder: string): Result<string, FsError> => {
      const moved = api.getState().moveEntry(path, folder);
      if (moved.ok) {
        setExpanded((current) => remapExpanded(current, path, moved.value));
        if (folder !== '') {
          expand(folder);
        }
        setAnnouncement(
          `Moved ${basename(path)} to ${folder === '' ? 'the project root' : folder}`,
        );
        focusItem(moved.value);
      } else {
        setAnnouncement(moved.error.message);
        log.warn('move rejected', { path, folder, error: moved.error.kind });
      }
      return moved;
    },
    [api, expand, focusItem],
  );

  const drag = useTreeDrag(
    useCallback(
      (path: string, folder: string) => {
        moveTo(path, folder);
      },
      [moveTo],
    ),
  );

  function select(path: string): void {
    setFocusedPath(path);
    api.getState().setTreeSelection(path);
  }

  function activate(path: string, kind: 'file' | 'directory'): void {
    select(path);
    if (kind === 'file') {
      api.getState().openFile(path);
    } else {
      setExpanded((current) => {
        const next = new Set(current);
        if (!next.delete(path)) {
          next.add(path);
        }
        return next;
      });
    }
  }

  function openMenu(target: MenuTarget, position: { x: number; y: number }): void {
    if (target.kind !== 'root') {
      select(target.path);
    }
    setMenu({ target, position });
  }

  const kindOf = (path: string): 'file' | 'directory' =>
    api.getState().fs.stat(path) === 'directory' ? 'directory' : 'file';

  function openMenuForRow(path: string, event: React.MouseEvent): void {
    event.preventDefault();
    openMenu({ path, kind: kindOf(path) }, menuPositionFor(event.currentTarget, event));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLUListElement>): void {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    const action = treeKeyAction(event, rows, visibleFocus);
    if (action === null) {
      return;
    }
    event.preventDefault();
    const kind = kindOf(action.path);
    switch (action.type) {
      case 'focus':
        focusItem(action.path);
        api.getState().setTreeSelection(action.path);
        break;
      case 'expand':
        expand(action.path);
        break;
      case 'collapse':
        setExpanded((current) => new Set([...current].filter((path) => path !== action.path)));
        break;
      case 'activate':
        activate(action.path, kind);
        break;
      case 'rename':
        setEditing({ mode: 'rename', path: action.path });
        break;
      case 'delete':
        setDeleting(action.path);
        break;
      case 'menu':
        openMenu(
          { path: action.path, kind },
          menuPositionFor(
            event.currentTarget.querySelector(`[data-path="${CSS.escape(action.path)}"]`),
          ),
        );
        break;
    }
  }

  function submitEditor(name: string): Result<unknown, FsError> {
    if (editing === null) {
      return { ok: true, value: undefined };
    }
    const store = api.getState();
    let result: Result<string, FsError>;
    if (editing.mode === 'rename') {
      result = store.renameEntry(editing.path, name);
      if (result.ok) {
        const target = result.value;
        setExpanded((current) => remapExpanded(current, editing.path, target));
      }
    } else if (editing.kind === 'file') {
      result = store.createFile(editing.parent, name);
    } else {
      result = store.createFolder(editing.parent, name);
      if (result.ok) {
        expand(result.value);
      }
    }
    if (result.ok) {
      setEditing(null);
      focusItem(result.value);
      api.getState().setTreeSelection(result.value);
    }
    return result;
  }

  const cancelEditor = useCallback(() => {
    setEditing((current) => {
      if (current?.mode === 'rename') {
        pendingFocus.current = current.path;
      }
      return null;
    });
  }, []);

  function confirmDelete(): void {
    if (deleting === null) {
      return;
    }
    const kind = kindOf(deleting);
    const neighbour = nextFocusAfterDelete(rows, deleting);
    const removed = api.getState().removeEntry(deleting);
    setDeleting(null);
    if (removed.ok) {
      setAnnouncement(`Deleted ${kind === 'file' ? 'file' : 'folder'} ${basename(deleting)}`);
      focusItem(neighbour);
    } else {
      setAnnouncement(removed.error.message);
    }
  }

  const menuItems =
    menu === null
      ? []
      : treeMenuItems(menu.target, {
          open: (path) => {
            api.getState().openFile(path);
          },
          newFile: (parent) => {
            startCreate('file', parent);
          },
          newFolder: (parent) => {
            startCreate('directory', parent);
          },
          rename: (path) => {
            setEditing({ mode: 'rename', path });
          },
          remove: setDeleting,
          move: setMoving,
        });

  const closeMenu = useCallback(() => {
    setMenu((current) => {
      if (current !== null && current.target.kind !== 'root') {
        pendingFocus.current = current.target.path;
      }
      return null;
    });
  }, []);

  return (
    <div className={styles.container}>
      {/* The tree's keyboard handling lives on the container of the roving-tabindex items (WAI-ARIA tree). */}
      <ul
        ref={treeRef}
        role="tree"
        aria-label="Files"
        className={styles.tree}
        {...(drag.state.dragging !== null ? { 'data-dragging': 'true' } : {})}
        {...(drag.canDrop && drag.state.over === '' ? { 'data-drop-target': 'true' } : {})}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          event.preventDefault();
          openMenu({ path: '', kind: 'root' }, { x: event.clientX, y: event.clientY });
        }}
        onPointerMove={drag.onTreePointerMove}
        onPointerLeave={drag.onTreePointerLeave}
      >
        <TreeRows
          rows={rows}
          focusedPath={visibleFocus}
          activePath={activeTab}
          dropTarget={drag.canDrop ? drag.state.over : null}
          editing={editing}
          editorProps={{ onSubmit: submitEditor, onCancel: cancelEditor }}
          onRowPointerDown={drag.onRowPointerDown}
          onRowClick={activate}
          onRowContextMenu={openMenuForRow}
          onRowFocus={select}
        />
      </ul>
      {/* Polite live region, not role="status": the Playground panel owns the page's status role. */}
      <div aria-live="polite" aria-atomic="true" className="visually-hidden">
        {announcement}
      </div>
      {menu === null ? null : (
        <Menu label="File actions" items={menuItems} position={menu.position} onClose={closeMenu} />
      )}
      {deleting === null ? null : (
        <DeleteDialog
          path={deleting}
          kind={kindOf(deleting)}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null);
          }}
        />
      )}
      {moving === null ? null : (
        <MoveDialog
          path={moving}
          entries={entries}
          onMove={(folder) => {
            setMoving(null);
            moveTo(moving, folder);
          }}
          onCancel={() => {
            setMoving(null);
          }}
        />
      )}
    </div>
  );
}
