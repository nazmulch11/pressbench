import type { HookType } from '@/lib/wp-data';

/** The functions whose first argument is a hook name, and which kind of hook they take. */
const HOOK_FUNCTIONS: Readonly<Record<string, HookType>> = {
  add_action: 'action',
  do_action: 'action',
  remove_action: 'action',
  add_filter: 'filter',
  apply_filters: 'filter',
  remove_filter: 'filter',
};

const FUNCTION_NAMES = Object.keys(HOOK_FUNCTIONS).join('|');

/** `add_action( 'ini` up to the cursor: the call, the quote and the partial name. */
const OPEN_HOOK_STRING = new RegExp(`\\b(${FUNCTION_NAMES})\\s*\\(\\s*(['"])([^'"]*)$`);

/** Every complete `add_action( 'name'` on a line. */
const HOOK_STRINGS = new RegExp(`\\b(${FUNCTION_NAMES})\\s*\\(\\s*(['"])([^'"]*)\\2`, 'g');

/** The hook name being typed as the first argument of a hook call. */
export interface HookCallContext {
  readonly type: HookType;
  /** What has been typed inside the quotes so far. */
  readonly prefix: string;
  /** 1-based column where the prefix starts (just after the opening quote). */
  readonly startColumn: number;
}

/** A complete hook name under the cursor. */
export interface HookAtPosition {
  readonly type: HookType;
  readonly name: string;
  readonly startColumn: number;
  readonly endColumn: number;
}

/**
 * Whether the cursor sits inside the first, quoted argument of `add_action`, `add_filter`, `do_action`,
 * `apply_filters`, `remove_action` or `remove_filter`, given the line text before the cursor.
 */
export function hookCallContext(lineBeforeCursor: string): HookCallContext | null {
  const match = OPEN_HOOK_STRING.exec(lineBeforeCursor);
  if (match === null) {
    return null;
  }
  const prefix = match[3] ?? '';
  return {
    type: HOOK_FUNCTIONS[match[1] ?? ''] ?? 'action',
    prefix,
    startColumn: lineBeforeCursor.length - prefix.length + 1,
  };
}

/** The hook name whose quotes enclose `column` (1-based) on `line`, if the string is a hook call's first argument. */
export function hookAtPosition(line: string, column: number): HookAtPosition | null {
  for (const match of line.matchAll(HOOK_STRINGS)) {
    const name = match[3] ?? '';
    const start = match.index + match[0].length - name.length - 1;
    const startColumn = start + 1;
    const endColumn = startColumn + name.length;
    if (column >= startColumn && column <= endColumn && name !== '') {
      return { type: HOOK_FUNCTIONS[match[1] ?? ''] ?? 'action', name, startColumn, endColumn };
    }
  }
  return null;
}
