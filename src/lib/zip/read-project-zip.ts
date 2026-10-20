/**
 * Reads an uploaded WordPress plugin or theme zip into project files, treating the zip as untrusted input
 * (docs/CODING_STANDARDS.md §8). Every entry name is checked and every size limit applied from the central
 * directory before anything is unpacked; `extractRecord` then refuses any file whose data does not match its
 * declared size, so the limits hold even when the archive lies.
 */
import { normalizePath, validateName } from '@/lib/fs';
import { err, ok, type Result } from '@/lib/result';

import type { ZipRecord } from './zip-archive';

const MB = 1024 * 1024;

/** Upper bounds for an uploaded zip. A plugin or theme is far smaller; the limits stop zip bombs. */
export const ZIP_LIMITS = {
  maxZipBytes: 20 * MB,
  maxEntries: 2000,
  maxFileBytes: 5 * MB,
  maxTotalBytes: 25 * MB,
  maxNameLength: 512,
  maxDepth: 32,
} as const;

export type ProjectKind = 'plugin' | 'theme';

/** A plugin or theme read from a zip. Paths are project-relative and start with `folder/`. */
export interface ProjectZip {
  readonly kind: ProjectKind;
  /** The project folder, for example `hello-dolly`. */
  readonly folder: string;
  /** The file to open first: the plugin's main PHP file, or the theme's `style.css`. */
  readonly mainFile: string;
  readonly files: Readonly<Record<string, string>>;
  /** Binary files the editor cannot hold (images, fonts, `.mo`), by project path. */
  readonly skipped: readonly string[];
}

export type ZipImportErrorKind =
  | 'too-large'
  | 'not-a-zip'
  | 'damaged'
  | 'unsupported'
  | 'empty'
  | 'unsafe-path'
  | 'layout'
  | 'not-wordpress';

/** Why a zip was refused. Nothing is returned when a zip is refused. */
export interface ZipImportError {
  readonly kind: ZipImportErrorKind;
  /** A sentence for the user. */
  readonly message: string;
}

interface FileEntry {
  readonly record: ZipRecord;
  readonly path: string;
}

// Resource forks and Finder files that macOS and Windows add when they compress a folder.
const JUNK_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
const BINARY_EXTENSIONS = new Set(
  'png jpg jpeg gif webp avif ico bmp tif tiff psd woff woff2 ttf otf eot mo zip gz tgz pdf mp3 mp4 m4a webm ogg oga wav mov'.split(
    ' ',
  ),
);
// Format characters (bidi overrides, zero-width spaces) make names look like other names.
const INVISIBLE = /\p{Cf}/u;
// C1 control characters (U+0080 to U+009F), which also appear when CP437 names are misread as Latin-1.
const C1_CONTROLS = /[\u0080-\u009f]/;
// WordPress reads headers from the first 8 KB of a file (get_file_data); the header may share a line with `<?php`.
const HEADER_BYTES = 8192;
const PLUGIN_HEADER = /^(?:[ \t]*<\?php)?[ \t/*#@]*Plugin Name:/im;
const THEME_HEADER = /^[ \t/*#@]*Theme Name:/im;
const SHOWN_NAME_LENGTH = 200;

function refuse(kind: ZipImportErrorKind, message: string): Result<never, ZipImportError> {
  return err({ kind, message });
}

function megabytes(bytes: number): string {
  return `${String(bytes / MB)} MB`;
}

/** A name as it appears in a message: long names are cut so a hostile name cannot flood the screen. */
function shown(name: string): string {
  return name.length > SHOWN_NAME_LENGTH ? `${name.slice(0, SHOWN_NAME_LENGTH)}…` : name;
}

function sentence(text: string): string {
  return text.endsWith('.') ? text : `${text}.`;
}

function isJunk(name: string): boolean {
  const segments = name.split('/');
  return segments[0] === '__MACOSX' || JUNK_NAMES.has(segments.at(-1) ?? '');
}

/** Checks one entry name; returns the project path or why the name is unsafe. */
function checkEntryName(name: string): Result<string, string> {
  if (name.length > ZIP_LIMITS.maxNameLength) {
    return err(`it is longer than ${String(ZIP_LIMITS.maxNameLength)} characters`);
  }
  if (name.includes('\\')) {
    return err('it uses backslashes');
  }
  if (name.startsWith('/') || /^[a-z]:/i.test(name)) {
    return err('it is an absolute path');
  }
  const path = name.replace(/\/+$/, '');
  const segments = path.split('/');
  if (segments.length > ZIP_LIMITS.maxDepth) {
    return err(`it is nested more than ${String(ZIP_LIMITS.maxDepth)} folders deep`);
  }
  if (segments.includes('..')) {
    return err('it goes outside the project folder');
  }
  if (INVISIBLE.test(path)) {
    return err('it contains invisible or direction-changing characters');
  }
  if (C1_CONTROLS.test(path)) {
    return err('it contains control characters');
  }
  const checked = normalizePath(path);
  return checked.ok ? ok(path) : err(checked.error.replace(/^Invalid path "[^"]*": /, ''));
}

/** Keeps the files to import; refuses on the first unsafe, duplicate or unsupported entry. */
function selectFiles(records: readonly ZipRecord[]): Result<FileEntry[], ZipImportError> {
  const files: FileEntry[] = [];
  // Compared the way case-insensitive, normalising file systems (macOS, Windows) would.
  const seen = new Set<string>();
  for (const record of records) {
    if (isJunk(record.name)) {
      continue;
    }
    if (record.name === '') {
      return refuse('unsafe-path', 'The zip contains an entry with an empty name.');
    }
    const checked = checkEntryName(record.name);
    if (!checked.ok) {
      return refuse(
        'unsafe-path',
        `The zip contains an unsafe path, "${shown(record.name)}": ${sentence(checked.error)}`,
      );
    }
    if (record.isDirectory) {
      continue;
    }
    if (record.method !== 0 && record.method !== 8) {
      return refuse(
        'unsupported',
        `"${shown(record.name)}" uses a compression method that is not supported. Re-create the zip with standard settings.`,
      );
    }
    const key = checked.value.normalize('NFC').toLowerCase();
    if (seen.has(key)) {
      return refuse(
        'unsafe-path',
        `"${shown(checked.value)}" appears more than once in the zip (names are compared without case, as Windows and macOS do).`,
      );
    }
    seen.add(key);
    files.push({ record, path: checked.value });
  }
  return ok(files);
}

function checkSizes(files: readonly FileEntry[]): Result<void, ZipImportError> {
  if (files.length === 0) {
    return refuse('empty', 'The zip is empty.');
  }
  if (files.length > ZIP_LIMITS.maxEntries) {
    return refuse('too-large', `The zip has more than ${String(ZIP_LIMITS.maxEntries)} files.`);
  }
  let total = 0;
  for (const file of files) {
    if (file.record.size > ZIP_LIMITS.maxFileBytes) {
      return refuse(
        'too-large',
        `"${shown(file.path)}" is larger than ${megabytes(ZIP_LIMITS.maxFileBytes)} when unpacked.`,
      );
    }
    total += file.record.size;
  }
  return total > ZIP_LIMITS.maxTotalBytes
    ? refuse('too-large', `The zip unpacks to more than ${megabytes(ZIP_LIMITS.maxTotalBytes)}.`)
    : ok(undefined);
}

/** The project folder and the prefix every entry needs to land inside it. */
function chooseFolder(
  files: readonly FileEntry[],
  fileName: string,
): Result<{ folder: string; prefix: string }, ZipImportError> {
  if (files.every((file) => file.path.includes('/'))) {
    const tops = [...new Set(files.map((file) => file.path.split('/')[0] ?? ''))].sort();
    const [only] = tops;
    if (tops.length === 1 && only !== undefined) {
      return ok({ folder: only, prefix: '' });
    }
    return refuse(
      'layout',
      `The zip has more than one top-level folder (${shown(tops.join(', '))}). A plugin or theme zip has exactly one.`,
    );
  }
  const folder = fileName.replace(/^.*[\\/]/, '').replace(/\.zip$/i, '');
  const valid = checkEntryName(folder);
  const name = valid.ok ? validateName(folder) : valid;
  if (!name.ok) {
    return refuse(
      'layout',
      `The files are not in a folder and "${shown(fileName)}" cannot name one: ${sentence(name.error)}`,
    );
  }
  return ok({ folder, prefix: `${folder}/` });
}

function decodeText(path: string, bytes: Uint8Array): string | null {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) {
    return null;
  }
  try {
    // ignoreBOM keeps a byte order mark: it is part of the file (and a classic "headers already sent" cause).
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return text.includes('\u0000') ? null : text;
  } catch {
    return null;
  }
}

function detect(
  folder: string,
  files: Readonly<Record<string, string>>,
): Result<{ kind: ProjectKind; mainFile: string }, ZipImportError> {
  const topLevel = Object.keys(files)
    .filter((path) => path.split('/').length === 2)
    .sort();
  const plugin = topLevel.find(
    (path) =>
      path.endsWith('.php') && PLUGIN_HEADER.test((files[path] ?? '').slice(0, HEADER_BYTES)),
  );
  if (plugin !== undefined) {
    return ok({ kind: 'plugin', mainFile: plugin });
  }
  const style = `${folder}/style.css`;
  if (THEME_HEADER.test((files[style] ?? '').slice(0, HEADER_BYTES))) {
    return ok({ kind: 'theme', mainFile: style });
  }
  return refuse(
    'not-wordpress',
    `This is not a WordPress plugin or theme: no PHP file in "${shown(folder)}" has a "Plugin Name:" header and there is no style.css with "Theme Name:".`,
  );
}

/** Refuses a zip over the size limit; callers check this before reading a file into memory. */
export function checkZipSize(byteLength: number): Result<void, ZipImportError> {
  return byteLength > ZIP_LIMITS.maxZipBytes
    ? refuse('too-large', `The zip is larger than ${megabytes(ZIP_LIMITS.maxZipBytes)}.`)
    : ok(undefined);
}

/**
 * Reads a plugin or theme zip. `fileName` names the project folder when the zip has its files at the root.
 *
 * @returns The project, or why the zip was refused. Never throws for bad input.
 */
export async function readProjectZip(
  data: Uint8Array,
  fileName: string,
): Promise<Result<ProjectZip, ZipImportError>> {
  const size = checkZipSize(data.length);
  if (!size.ok) {
    return size;
  }
  // Loaded on demand with fflate's inflater, so neither is in the first page load.
  const { extractRecord, listZip } = await import('./zip-archive');
  const listed = listZip(data);
  if (!listed.ok) {
    return listed;
  }
  const selected = selectFiles(listed.value);
  if (!selected.ok) {
    return selected;
  }
  const sizes = checkSizes(selected.value);
  if (!sizes.ok) {
    return sizes;
  }
  const place = chooseFolder(selected.value, fileName);
  if (!place.ok) {
    return place;
  }

  const files: Record<string, string> = {};
  const skipped: string[] = [];
  for (const entry of selected.value) {
    const bytes = extractRecord(data, entry.record);
    if (!bytes.ok) {
      return bytes;
    }
    const path = `${place.value.prefix}${entry.path}`;
    const text = decodeText(path, bytes.value);
    if (text === null) {
      skipped.push(path);
    } else {
      files[path] = text;
    }
  }
  skipped.sort();

  const found = detect(place.value.folder, files);
  if (!found.ok) {
    return found;
  }
  return ok({ ...found.value, folder: place.value.folder, files, skipped });
}
