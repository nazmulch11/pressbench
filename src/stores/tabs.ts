import { isAncestor } from '@/lib/fs';

/** The tab to activate after `closed` goes away: the one to its right, else to its left, else none. */
export function nextActiveTab(
  tabs: readonly string[],
  activeTab: string | null,
  closed: string,
): string | null {
  if (activeTab !== closed) {
    return activeTab;
  }
  const index = tabs.indexOf(closed);
  return tabs[index + 1] ?? tabs[index - 1] ?? null;
}

/** Where `path` ends up when `from` (a file or a folder above it) is renamed to `to`; `null` when untouched. */
export function remapPath(path: string, from: string, to: string): string | null {
  if (path === from) {
    return to;
  }
  return isAncestor(from, path) ? to + path.slice(from.length) : null;
}

/** Applies {@link remapPath} to every key of a draft map. */
export function remapDrafts(
  drafts: Readonly<Record<string, string>>,
  from: string,
  to: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(drafts).map(([path, content]) => [remapPath(path, from, to) ?? path, content]),
  );
}

/** Drops the drafts of `removed` and everything below it. */
export function dropDrafts(
  drafts: Readonly<Record<string, string>>,
  removed: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(drafts).filter(([path]) => path !== removed && !isAncestor(removed, path)),
  );
}

/** Moves `item` to `toIndex`; returns the same array when the move is impossible. */
export function moveItem<T>(items: readonly T[], item: T, toIndex: number): readonly T[] {
  const fromIndex = items.indexOf(item);
  if (fromIndex === -1 || toIndex < 0 || toIndex >= items.length || toIndex === fromIndex) {
    return items;
  }
  const next = [...items];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

/** The draft map without `path`. */
export function withoutDraft(
  drafts: Readonly<Record<string, string>>,
  path: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== path));
}
