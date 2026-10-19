import type { Result } from '@/lib/result';

/** Why a file-system call failed. */
export type FsErrorKind =
  'invalid-path' | 'not-found' | 'exists' | 'not-a-directory' | 'is-directory' | 'invalid-move';

/** A failed file-system call, as a value. */
export interface FsError {
  readonly kind: FsErrorKind;
  /** The path the call was about. */
  readonly path: string;
  /** A sentence for the user. */
  readonly message: string;
}

export type FsEntryKind = 'file' | 'directory';

/** One file or folder. Paths are project-relative, `/`-separated and never start with `/`. */
export interface FsEntry {
  readonly path: string;
  readonly name: string;
  readonly kind: FsEntryKind;
}

/** Emitted after every successful change. Failed calls emit nothing. */
export type FsChange =
  | { readonly type: 'write'; readonly path: string; readonly created: boolean }
  | { readonly type: 'mkdir'; readonly path: string }
  | { readonly type: 'remove'; readonly path: string; readonly kind: FsEntryKind }
  | {
      readonly type: 'rename';
      readonly from: string;
      readonly to: string;
      readonly kind: FsEntryKind;
    };

export type FsChangeListener = (change: FsChange) => void;

/**
 * The in-memory project file system behind the workspace. Later phases sync it to Playground and OPFS.
 * Every mutating call validates its paths and returns a `Result`; nothing throws for bad input.
 */
export interface ProjectFs {
  /** Reads a file. */
  read(path: string): Result<string, FsError>;
  /** Writes a file, creating missing parent folders. */
  write(path: string, content: string): Result<void, FsError>;
  /** Creates a folder (and missing parents). Fails if something already exists at the path. */
  mkdir(path: string): Result<void, FsError>;
  /** Renames or moves a file or folder. Folder contents move with it. */
  rename(from: string, to: string): Result<void, FsError>;
  /** Removes a file, or a folder with everything inside it. */
  remove(path: string): Result<void, FsError>;
  /** Whether a file or folder exists. The root (`''`) always exists. */
  exists(path: string): boolean;
  /** The kind of the entry at `path`, or `undefined` when nothing is there. */
  stat(path: string): FsEntryKind | undefined;
  /** Direct children of a folder, folders first, then names in natural order. */
  list(directory: string): readonly FsEntry[];
  /** Every entry, sorted by path. */
  entries(): readonly FsEntry[];
  /** Subscribes to changes; returns the unsubscribe function. */
  onChange(listener: FsChangeListener): () => void;
}

/** Initial contents for {@link ProjectFs}. */
export interface ProjectFsSeed {
  readonly files?: Readonly<Record<string, string>>;
  readonly directories?: readonly string[];
}
