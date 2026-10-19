import { err, ok, type Result } from '@/lib/result';

const MAX_NAME_LENGTH = 255;
// Windows refuses these names with any extension; a project that cannot be unzipped on Windows is a bug.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
// eslint-disable-next-line no-control-regex -- the null byte and other control characters are the point
const INVALID_CHARACTERS = /[<>:"|?*\u0000-\u001f]/;

/**
 * Checks one path segment (a file or folder name) and explains what is wrong with it.
 * Accepts dot-files such as `.htaccess`.
 */
export function validateName(name: string): Result<string, string> {
  if (name.length === 0) {
    return err('Name cannot be empty.');
  }
  if (name.includes('/') || name.includes('\\')) {
    return err('Name cannot contain slashes.');
  }
  if (name === '.' || name === '..') {
    return err('Name cannot be a dot or two dots.');
  }
  if (INVALID_CHARACTERS.test(name)) {
    return err('Name contains invalid characters (< > : " | ? * or control characters).');
  }
  if (WINDOWS_RESERVED.test(name)) {
    return err(`"${name}" is a reserved name on Windows.`);
  }
  if (name.endsWith('.') || name.endsWith(' ')) {
    return err('Name cannot end with a dot or a space.');
  }
  if (name.length > MAX_NAME_LENGTH) {
    return err(`Name is too long (maximum ${String(MAX_NAME_LENGTH)} characters).`);
  }
  return ok(name);
}

/**
 * Checks a project-relative path: `/`-separated, no leading or trailing slash, no empty, `.` or `..` segments,
 * every segment a valid name. The empty string is the project root.
 */
export function normalizePath(path: string): Result<string, string> {
  if (path === '') {
    return ok('');
  }
  if (path.startsWith('/')) {
    return err('Path cannot be absolute.');
  }
  for (const segment of path.split('/')) {
    const checked = validateName(segment);
    if (!checked.ok) {
      return err(`Invalid path "${path}": ${checked.error}`);
    }
  }
  return ok(path);
}

/** The folder part of a path; `''` for a top-level entry. */
export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

/** The last segment of a path. */
export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Joins a folder and a name; the root folder is `''`. */
export function joinPath(directory: string, name: string): string {
  return directory === '' ? name : `${directory}/${name}`;
}

/** Whether `ancestor` is a folder above `path` (the root is above everything but itself). */
export function isAncestor(ancestor: string, path: string): boolean {
  if (ancestor === path) {
    return false;
  }
  return ancestor === '' || path.startsWith(`${ancestor}/`);
}
