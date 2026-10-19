import { useRef, useState } from 'react';

import { basename } from '@/lib/fs';
import { useWorkspaceStore, useWorkspaceStoreApi } from '@/stores';

import styles from './TabBar.module.css';

const DRAG_THRESHOLD_PX = 4;

/**
 * Open files as a list of buttons (not ARIA tabs: the separate close buttons would break the tab pattern).
 * Reorder by dragging a tab over another, or with Alt+Shift+ArrowLeft/ArrowRight on a focused tab.
 */
export function TabBar(): React.JSX.Element {
  const api = useWorkspaceStoreApi();
  const tabs = useWorkspaceStore((state) => state.tabs);
  const activeTab = useWorkspaceStore((state) => state.activeTab);
  const drafts = useWorkspaceStore((state) => state.drafts);
  const pending = useRef<{ path: string; x: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  function onKeyDown(path: string, event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (!event.altKey || !event.shiftKey) {
      return;
    }
    const index = tabs.indexOf(path);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      api.getState().moveTab(path, event.key === 'ArrowLeft' ? index - 1 : index + 1);
      event.currentTarget.focus();
    }
  }

  function endDrag(): void {
    pending.current = null;
    setDragging(null);
  }

  return (
    <ul
      aria-label="Open files"
      className={styles.bar}
      onPointerMove={(event) => {
        const start = pending.current;
        if (start !== null && dragging === null) {
          if (Math.abs(event.clientX - start.x) >= DRAG_THRESHOLD_PX) {
            setDragging(start.path);
          }
        }
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      {tabs.map((path) => {
        const name = basename(path);
        const isDirty = drafts[path] !== undefined;
        const isActive = path === activeTab;
        return (
          <li
            key={path}
            className={styles.tab}
            {...(isActive ? { 'data-active': 'true' } : {})}
            {...(dragging === path ? { 'data-dragging': 'true' } : {})}
            title={path}
            onPointerEnter={() => {
              if (dragging !== null && dragging !== path) {
                api.getState().moveTab(dragging, tabs.indexOf(path));
              }
            }}
          >
            <button
              type="button"
              className={styles.open}
              aria-label={isDirty ? `${name}, unsaved` : name}
              {...(isActive ? { 'aria-current': 'true' } : {})}
              onPointerDown={(event) => {
                if (event.button === 0) {
                  pending.current = { path, x: event.clientX };
                }
              }}
              onClick={() => {
                api.getState().activateTab(path);
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  api.getState().closeTab(path);
                }
              }}
              onKeyDown={(event) => {
                onKeyDown(path, event);
              }}
            >
              <span className={styles.name}>{name}</span>
              {isDirty ? (
                <span className={styles.dirty} aria-hidden="true">
                  ●
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={styles.close}
              aria-label={`Close ${name}`}
              onClick={() => {
                api.getState().closeTab(path);
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
