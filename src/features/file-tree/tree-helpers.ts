import type { TreeRow } from '@/lib/fs';

/** The expanded set after `from` (and everything below it) became `to`. */
export function remapExpanded(
  expanded: ReadonlySet<string>,
  from: string,
  to: string,
): Set<string> {
  const next = new Set<string>();
  for (const path of expanded) {
    if (path === from) {
      next.add(to);
    } else if (path.startsWith(`${from}/`)) {
      next.add(to + path.slice(from.length));
    } else {
      next.add(path);
    }
  }
  return next;
}

/** The row to focus once `path` is gone: the first row after its subtree, else the row above, else none. */
export function nextFocusAfterDelete(rows: readonly TreeRow[], path: string): string | null {
  const index = rows.findIndex((row) => row.path === path);
  if (index === -1) {
    return null;
  }
  const after = rows.slice(index + 1).find((row) => !row.path.startsWith(`${path}/`));
  return after?.path ?? rows[index - 1]?.path ?? null;
}

/** Where a context menu opened from the keyboard (or a synthetic event at 0,0) should appear for a row. */
export function menuPositionFor(
  element: Element | null | undefined,
  event?: { clientX: number; clientY: number },
): { x: number; y: number } {
  if (event !== undefined && (event.clientX !== 0 || event.clientY !== 0)) {
    return { x: event.clientX, y: event.clientY };
  }
  const rect = element?.getBoundingClientRect();
  return { x: (rect?.left ?? 0) + 24, y: rect?.bottom ?? 0 };
}
