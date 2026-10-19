import { err, ok, type Result } from '@/lib/result';

import { basename, dirname, isAncestor, normalizePath } from './paths';
import type {
  FsChange,
  FsChangeListener,
  FsEntry,
  FsEntryKind,
  FsError,
  FsErrorKind,
  ProjectFs,
  ProjectFsSeed,
} from './types';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Sort order for listings: folders first, then names in natural, case-insensitive order. */
export function compareEntries(a: FsEntry, b: FsEntry): number {
  if (a.kind !== b.kind) {
    return a.kind === 'directory' ? -1 : 1;
  }
  return collator.compare(a.name, b.name) || a.name.localeCompare(b.name);
}

function failure(kind: FsErrorKind, path: string, message: string): Result<never, FsError> {
  return err({ kind, path, message });
}

function entry(path: string, kind: FsEntryKind): FsEntry {
  return { path, name: basename(path), kind };
}

/** Creates an empty or seeded in-memory {@link ProjectFs}. */
export function createProjectFs(seed: ProjectFsSeed = {}): ProjectFs {
  const files = new Map<string, string>();
  const directories = new Set<string>();
  const listeners = new Set<FsChangeListener>();

  function emit(change: FsChange): void {
    for (const listener of listeners) {
      listener(change);
    }
  }

  function kindOf(path: string): FsEntryKind | undefined {
    if (files.has(path)) {
      return 'file';
    }
    return path === '' || directories.has(path) ? 'directory' : undefined;
  }

  /** Makes every folder above `path` exist; fails when a file is in the way. */
  function ensureParents(path: string): Result<void, FsError> {
    const parent = dirname(path);
    if (parent === '' || directories.has(parent)) {
      return ok(undefined);
    }
    if (files.has(parent)) {
      return failure('not-a-directory', parent, `"${parent}" is a file, not a folder.`);
    }
    const above = ensureParents(parent);
    if (!above.ok) {
      return above;
    }
    directories.add(parent);
    return ok(undefined);
  }

  function checkPath(path: string): Result<string, FsError> {
    const normalized = normalizePath(path);
    return normalized.ok ? normalized : failure('invalid-path', path, normalized.error);
  }

  /** Every entry at or below `path`, deepest first (safe to delete in order). */
  function subtree(path: string): FsEntry[] {
    const found: FsEntry[] = [];
    for (const file of files.keys()) {
      if (file === path || isAncestor(path, file)) {
        found.push(entry(file, 'file'));
      }
    }
    for (const directory of directories) {
      if (directory === path || isAncestor(path, directory)) {
        found.push(entry(directory, 'directory'));
      }
    }
    return found.sort((a, b) => b.path.length - a.path.length);
  }

  function write(path: string, content: string): Result<void, FsError> {
    const checked = checkPath(path);
    if (!checked.ok) {
      return checked;
    }
    if (path === '' || directories.has(path)) {
      return failure('is-directory', path, `"${path}" is a folder.`);
    }
    const parents = ensureParents(path);
    if (!parents.ok) {
      return parents;
    }
    const created = !files.has(path);
    files.set(path, content);
    emit({ type: 'write', path, created });
    return ok(undefined);
  }

  function mkdir(path: string): Result<void, FsError> {
    const checked = checkPath(path);
    if (!checked.ok) {
      return checked;
    }
    if (kindOf(path) !== undefined) {
      return failure('exists', path, `"${path}" already exists.`);
    }
    const parents = ensureParents(path);
    if (!parents.ok) {
      return parents;
    }
    directories.add(path);
    emit({ type: 'mkdir', path });
    return ok(undefined);
  }

  function remove(path: string): Result<void, FsError> {
    const checked = checkPath(path);
    if (!checked.ok) {
      return checked;
    }
    const kind = kindOf(path);
    if (kind === undefined || path === '') {
      return failure('not-found', path, `"${path}" does not exist.`);
    }
    for (const removed of subtree(path)) {
      files.delete(removed.path);
      directories.delete(removed.path);
    }
    emit({ type: 'remove', path, kind });
    return ok(undefined);
  }

  function checkMove(from: string, to: string): Result<FsEntryKind, FsError> {
    const kind = kindOf(from);
    if (kind === undefined || from === '') {
      return failure('not-found', from, `"${from}" does not exist.`);
    }
    if (from === to || isAncestor(from, to)) {
      return failure('invalid-move', to, `Cannot move "${from}" into itself.`);
    }
    if (kindOf(to) !== undefined) {
      return failure('exists', to, `"${to}" already exists.`);
    }
    const parent = dirname(to);
    if (kindOf(parent) !== 'directory') {
      return failure('not-found', parent, `Folder "${parent}" does not exist.`);
    }
    return ok(kind);
  }

  function rename(from: string, to: string): Result<void, FsError> {
    const checkedFrom = checkPath(from);
    if (!checkedFrom.ok) {
      return checkedFrom;
    }
    const checkedTo = checkPath(to);
    if (!checkedTo.ok) {
      return checkedTo;
    }
    const move = checkMove(from, to);
    if (!move.ok) {
      return move;
    }
    for (const moved of subtree(from)) {
      const target = to + moved.path.slice(from.length);
      if (moved.kind === 'file') {
        files.set(target, files.get(moved.path) ?? '');
        files.delete(moved.path);
      } else {
        directories.add(target);
        directories.delete(moved.path);
      }
    }
    emit({ type: 'rename', from, to, kind: move.value });
    return ok(undefined);
  }

  function read(path: string): Result<string, FsError> {
    const checked = checkPath(path);
    if (!checked.ok) {
      return checked;
    }
    const content = files.get(path);
    if (content !== undefined) {
      return ok(content);
    }
    return kindOf(path) === 'directory'
      ? failure('is-directory', path, `"${path}" is a folder.`)
      : failure('not-found', path, `"${path}" does not exist.`);
  }

  function entries(): readonly FsEntry[] {
    return [
      ...[...directories].map((path) => entry(path, 'directory')),
      ...[...files.keys()].map((path) => entry(path, 'file')),
    ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  function list(directory: string): readonly FsEntry[] {
    return entries()
      .filter((candidate) => dirname(candidate.path) === directory && candidate.path !== '')
      .sort(compareEntries);
  }

  for (const directory of seed.directories ?? []) {
    if (directory !== '') {
      mkdir(directory);
    }
  }
  for (const [path, content] of Object.entries(seed.files ?? {})) {
    write(path, content);
  }

  return {
    read,
    write,
    mkdir,
    rename,
    remove,
    exists: (path) => kindOf(path) !== undefined,
    stat: kindOf,
    list,
    entries,
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
