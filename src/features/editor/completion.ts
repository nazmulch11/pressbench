import type { WordPressData, WordPressFunction, WordPressHook } from '@/lib/wp-data';

import { functionDocsUrl, hookDocsUrl } from './docs-links';
import { hookCallContext } from './hook-context';

/** A completion item before it is turned into Monaco's shape. */
export interface Suggestion {
  readonly label: string;
  readonly kind: 'function' | 'action' | 'filter';
  readonly insertText: string;
  /** `insertText` uses snippet placeholders (`$0`). */
  readonly isSnippet: boolean;
  /** Short text shown next to the label: the signature or the hook type. */
  readonly detail: string;
  /** Markdown shown in the details pane. */
  readonly documentation: string;
  readonly deprecated: boolean;
  readonly sortText: string;
  /** 1-based column where the replaced text starts. */
  readonly startColumn: number;
}

/** What the provider knows about the cursor. */
export interface CompletionQuery {
  readonly lineBeforeCursor: string;
  readonly lineAfterCursor: string;
  /** The identifier being typed, as Monaco sees it. */
  readonly word: string;
  readonly wordStartColumn: number;
}

export interface CompletionResult {
  readonly suggestions: readonly Suggestion[];
  /** Ask again on the next keystroke (function lists are filtered by prefix). */
  readonly incomplete: boolean;
}

const EMPTY: CompletionResult = { suggestions: [], incomplete: false };

/**
 * Suggestions for the cursor position in a PHP file: hook names inside the first argument of a hook call,
 * otherwise WordPress functions matching the word being typed. Nothing inside other strings.
 */
export function suggest(query: CompletionQuery, data: WordPressData): CompletionResult {
  const hookCall = hookCallContext(query.lineBeforeCursor);
  if (hookCall !== null) {
    const prefix = hookCall.prefix.toLowerCase();
    const suggestions = data.hooks
      .filter((hook) => hook.type === hookCall.type && hook.name.toLowerCase().includes(prefix))
      .map((hook) => hookSuggestion(hook, hookCall.startColumn));
    return { suggestions, incomplete: false };
  }
  if (query.word === '' || isInsideString(query.lineBeforeCursor)) {
    return EMPTY;
  }
  const word = query.word.toLowerCase();
  const callFollows = /^\s*\(/.test(query.lineAfterCursor);
  const suggestions = data.functions
    .filter((fn) => fn.name.toLowerCase().includes(word))
    .map((fn) => functionSuggestion(fn, query.wordStartColumn, callFollows));
  return { suggestions, incomplete: true };
}

/** A rough check: an odd number of unescaped quotes before the cursor means the cursor is inside a string. */
function isInsideString(lineBeforeCursor: string): boolean {
  const unquoted = lineBeforeCursor.replace(/\\./g, '');
  const single = (unquoted.match(/'/g) ?? []).length;
  const double = (unquoted.match(/"/g) ?? []).length;
  return single % 2 === 1 || double % 2 === 1;
}

function functionSuggestion(
  fn: WordPressFunction,
  startColumn: number,
  callFollows: boolean,
): Suggestion {
  const deprecated = fn.deprecated !== undefined;
  const hasParams = fn.params.length > 0;
  const insertText = callFollows ? fn.name : hasParams ? `${fn.name}( $0 )` : `${fn.name}()`;
  return {
    label: fn.name,
    kind: 'function',
    insertText,
    isSnippet: !callFollows && hasParams,
    detail: `${fn.name}${fn.signature}`,
    documentation: functionDocumentation(fn),
    deprecated,
    sortText: `${deprecated ? '1' : '0'}${fn.name}`,
    startColumn,
  };
}

function hookSuggestion(hook: WordPressHook, startColumn: number): Suggestion {
  const deprecated = hook.deprecated !== undefined;
  return {
    label: hook.name,
    kind: hook.type,
    insertText: hook.name,
    isSnippet: false,
    detail: `WordPress ${hook.type}`,
    documentation: hookDocumentation(hook),
    deprecated,
    sortText: `${deprecated ? '1' : '0'}${hook.name}`,
    startColumn,
  };
}

/** Markdown for a function: summary, version notes and the reference link. */
export function functionDocumentation(fn: WordPressFunction): string {
  return [fn.summary, versionNotes(fn), `[developer.wordpress.org](${functionDocsUrl(fn.name)})`]
    .filter((part) => part !== '')
    .join('\n\n');
}

/** Markdown for a hook: summary, version notes and the reference link. */
export function hookDocumentation(hook: WordPressHook): string {
  return [hook.summary, versionNotes(hook), `[developer.wordpress.org](${hookDocsUrl(hook.name)})`]
    .filter((part) => part !== '')
    .join('\n\n');
}

function versionNotes(entry: { since?: string; deprecated?: string }): string {
  const notes: string[] = [];
  if (entry.since !== undefined) {
    notes.push(`Since ${entry.since}.`);
  }
  if (entry.deprecated !== undefined) {
    notes.push(entry.deprecated === '' ? 'Deprecated.' : `Deprecated since ${entry.deprecated}.`);
  }
  return notes.join(' ');
}
