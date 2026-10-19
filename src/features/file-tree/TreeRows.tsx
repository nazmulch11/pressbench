import { Fragment } from 'react';

import type { TreeRow } from '@/lib/fs';

import styles from './FileTree.module.css';
import { NameEditor, type NameEditorProps } from './NameEditor';

/** The inline editor the tree is showing, if any. */
export type TreeEditing =
  | { readonly mode: 'create'; readonly kind: 'file' | 'directory'; readonly parent: string }
  | { readonly mode: 'rename'; readonly path: string };

export interface TreeRowsProps {
  rows: readonly TreeRow[];
  focusedPath: string | null;
  activePath: string | null;
  dropTarget: string | null;
  editing: TreeEditing | null;
  editorProps: Omit<NameEditorProps, 'label' | 'initialValue'>;
  onRowPointerDown: (path: string, event: React.PointerEvent) => void;
  onRowClick: (path: string, kind: 'file' | 'directory') => void;
  onRowContextMenu: (path: string, event: React.MouseEvent) => void;
  onRowFocus: (path: string) => void;
}

function CreateRow({
  editing,
  depth,
  editorProps,
}: {
  editing: Extract<TreeEditing, { mode: 'create' }>;
  depth: number;
  editorProps: TreeRowsProps['editorProps'];
}): React.JSX.Element {
  return (
    <li role="treeitem" aria-level={depth + 1} aria-selected={false} className={styles.item}>
      <div className={styles.row} style={{ '--depth': depth } as React.CSSProperties}>
        <span className={styles.icon} aria-hidden="true" data-kind={editing.kind} />
        <NameEditor
          label={editing.kind === 'file' ? 'New file name' : 'New folder name'}
          {...editorProps}
        />
      </div>
    </li>
  );
}

/**
 * The visible rows as a flat list of `treeitem`s with `aria-level`, `aria-posinset` and `aria-setsize` (the flat
 * tree pattern). Each row's accessible name is its own label only, so folders do not inherit their children's text.
 */
export function TreeRows(props: TreeRowsProps): React.JSX.Element {
  const { rows, focusedPath, activePath, dropTarget, editing, editorProps } = props;
  const create = editing?.mode === 'create' ? editing : null;

  return (
    <>
      {create?.parent === '' ? (
        <CreateRow editing={create} depth={0} editorProps={editorProps} />
      ) : null}
      {rows.map((row) => {
        const isRenaming = editing?.mode === 'rename' && editing.path === row.path;
        return (
          <Fragment key={row.path}>
            {/* Keyboard handling for every row lives on the tree container (roving tabindex, WAI-ARIA tree). */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- see above */}
            <li
              role="treeitem"
              aria-level={row.depth + 1}
              aria-posinset={row.position}
              aria-setsize={row.setSize}
              aria-selected={row.path === focusedPath}
              {...(row.hasChildren ? { 'aria-expanded': row.isExpanded } : {})}
              tabIndex={row.path === focusedPath ? 0 : -1}
              className={styles.item}
              data-path={row.path}
              data-kind={row.kind}
              {...(row.path === activePath ? { 'data-active': 'true' } : {})}
              {...(dropTarget === row.path ? { 'data-drop-target': 'true' } : {})}
              onPointerDown={(event) => {
                props.onRowPointerDown(row.path, event);
              }}
              onClick={(event) => {
                // Clicks inside an inline name editor are for the editor, not the row.
                if (!(event.target instanceof Element && event.target.closest('form') !== null)) {
                  props.onRowClick(row.path, row.kind);
                }
              }}
              onContextMenu={(event) => {
                event.stopPropagation();
                props.onRowContextMenu(row.path, event);
              }}
              onFocus={(event) => {
                if (event.target === event.currentTarget) {
                  props.onRowFocus(row.path);
                }
              }}
            >
              <div className={styles.row} style={{ '--depth': row.depth } as React.CSSProperties}>
                <span
                  className={styles.icon}
                  aria-hidden="true"
                  data-kind={row.kind}
                  data-expanded={row.isExpanded}
                />
                {isRenaming ? (
                  <NameEditor label="New name" initialValue={row.name} {...editorProps} />
                ) : (
                  <span className={styles.label}>{row.name}</span>
                )}
              </div>
            </li>
            {create?.parent === row.path ? (
              <CreateRow editing={create} depth={row.depth + 1} editorProps={editorProps} />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}
