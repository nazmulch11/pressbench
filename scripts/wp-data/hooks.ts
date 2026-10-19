/**
 * Converts `@wp-hooks/wordpress-core`'s `actions.json` and `filters.json` into the compact hook list the
 * editor ships. Only the fields completion and hover show are kept.
 */
import { deprecatedVersion, firstSentence, versionOf } from './docblock';
import type { HookType, WordPressHook, WordPressParam } from '../../src/lib/wp-data/types';

/** The subset of the package's JSON schema that the converter reads. */
export interface HooksJson {
  readonly hooks: readonly {
    readonly name: string;
    readonly file: string;
    readonly type: HookType;
    readonly doc: {
      readonly description: string;
      readonly long_description: string;
      readonly tags: readonly {
        readonly name: string;
        readonly content: string;
        readonly types?: readonly string[];
        readonly variable?: string;
      }[];
    };
    readonly args: number;
  }[];
}

/** Merges both files into one list sorted by type then name, one entry per hook name. */
export function convertHooks(actions: HooksJson, filters: HooksJson): WordPressHook[] {
  const seen = new Set<string>();
  const hooks: WordPressHook[] = [];
  for (const entry of [...actions.hooks, ...filters.hooks]) {
    const key = `${entry.type}:${entry.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    hooks.push(toHook(entry));
  }
  return hooks.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

function toHook(entry: HooksJson['hooks'][number]): WordPressHook {
  const since = entry.doc.tags.find((tag) => tag.name === 'since')?.content;
  const deprecated = entry.doc.tags.find((tag) => tag.name === 'deprecated')?.content;
  return {
    name: entry.name,
    type: entry.type,
    summary: entry.doc.description.trim(),
    params: entry.doc.tags
      .filter((tag) => tag.name === 'param' && tag.variable !== undefined)
      .map(toParam),
    ...(since === undefined ? {} : { since: versionOf(since) }),
    ...(deprecated === undefined ? {} : { deprecated: deprecatedVersion(deprecated) }),
  };
}

function toParam(tag: HooksJson['hooks'][number]['doc']['tags'][number]): WordPressParam {
  const type = tag.types?.join('|');
  const description = firstSentence(tag.content);
  return {
    name: tag.variable ?? '',
    ...(type === undefined || type === '' ? {} : { type }),
    ...(description === '' ? {} : { description }),
  };
}
