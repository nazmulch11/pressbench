import { useCallback, useEffect, useRef, useState } from 'react';

import { dirname, isAncestor } from '@/lib/fs';
import { createLogger } from '@/lib/logger';

const log = createLogger('file-tree');

const DRAG_THRESHOLD_PX = 4;

export interface TreeDragState {
  /** Path being dragged, once the pointer moved past the threshold. */
  readonly dragging: string | null;
  /** Folder the pointer is over (`''` for the root), or `null` when outside the tree. */
  readonly over: string | null;
}

export interface TreeDragHandlers {
  readonly state: TreeDragState;
  /** Whether dropping `dragging` on `state.over` would move it somewhere new. */
  readonly canDrop: boolean;
  onRowPointerDown: (path: string, event: React.PointerEvent) => void;
  /** On the tree container: resolves the folder under the pointer from the row's `data-path` and `data-kind`. */
  onTreePointerMove: (event: React.PointerEvent) => void;
  onTreePointerLeave: () => void;
}

interface Pending {
  readonly path: string;
  readonly x: number;
  readonly y: number;
}

function folderUnder(target: EventTarget | null): string {
  if (!(target instanceof Element)) {
    return '';
  }
  const row = target.closest<HTMLElement>('[data-path]');
  if (row === null) {
    return '';
  }
  const path = row.dataset.path ?? '';
  return row.dataset.kind === 'directory' ? path : dirname(path);
}

/**
 * Drag-to-move for tree rows on pointer events (no HTML5 drag API, so every engine and jsdom behave the same).
 * A press becomes a drag after a few pixels; releasing over a folder calls `onDrop`.
 */
export function useTreeDrag(onDrop: (path: string, folder: string) => void): TreeDragHandlers {
  const pending = useRef<Pending | null>(null);
  const [state, setRenderedState] = useState<TreeDragState>({ dragging: null, over: null });
  // Written together with every state update, so a pointerup that lands before the next render sees the
  // latest drop target.
  const latest = useRef<{ state: TreeDragState; onDrop: typeof onDrop }>({ state, onDrop });
  const setState = useCallback((next: TreeDragState) => {
    latest.current = { ...latest.current, state: next };
    setRenderedState(next);
  }, []);

  useEffect(() => {
    latest.current = { ...latest.current, onDrop };
  }, [onDrop]);

  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      const start = pending.current;
      if (start === null || latest.current.state.dragging !== null) {
        return;
      }
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= DRAG_THRESHOLD_PX) {
        log.debug('drag start', { path: start.path });
        setState({ dragging: start.path, over: null });
      }
    };
    const onUp = (): void => {
      const { state: current, onDrop: drop } = latest.current;
      pending.current = null;
      if (current.dragging !== null) {
        log.debug('drag end', { path: current.dragging, over: current.over });
        if (current.over !== null && isValidDrop(current.dragging, current.over)) {
          drop(current.dragging, current.over);
        }
        setState({ dragging: null, over: null });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [setState]);

  return {
    state,
    canDrop:
      state.dragging !== null && state.over !== null && isValidDrop(state.dragging, state.over),
    onRowPointerDown(path, event) {
      if (event.button === 0 && !(event.target instanceof HTMLInputElement)) {
        pending.current = { path, x: event.clientX, y: event.clientY };
      }
    },
    onTreePointerMove(event) {
      if (state.dragging !== null) {
        const over = folderUnder(event.target);
        if (over !== state.over) {
          setState({ dragging: state.dragging, over });
        }
      }
    },
    onTreePointerLeave() {
      if (state.dragging !== null && state.over !== null) {
        setState({ dragging: state.dragging, over: null });
      }
    },
  };
}

function isValidDrop(path: string, folder: string): boolean {
  return folder !== dirname(path) && folder !== path && !isAncestor(path, folder);
}
