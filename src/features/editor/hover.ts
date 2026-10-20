import type { HookType, WordPressData, WordPressParam } from '@/lib/wp-data';

import { functionDocumentation, hookDocumentation } from './completion';

/** Markdown blocks for Monaco's hover widget. */
export interface HoverContent {
  readonly contents: readonly string[];
}

/** Hover for a WordPress function name, or `null` when the word is not one. */
export function functionHover(name: string, data: WordPressData): HoverContent | null {
  const fn = data.functions.find((candidate) => candidate.name === name);
  if (fn === undefined) {
    return null;
  }
  const signature = `${fn.name}${fn.signature}${fn.returns === undefined ? '' : `: ${fn.returns}`}`;
  return {
    contents: [
      `\`\`\`php\n${signature}\n\`\`\``,
      ...paramsBlock(fn.params),
      functionDocumentation(fn),
    ],
  };
}

/** Hover for a hook name of the given type, or `null` when WordPress core has no such hook. */
export function hookHover(name: string, type: HookType, data: WordPressData): HoverContent | null {
  const hook = data.hooks.find((candidate) => candidate.name === name && candidate.type === type);
  if (hook === undefined) {
    return null;
  }
  return {
    contents: [
      `**${hook.name}** (WordPress ${hook.type})`,
      ...paramsBlock(hook.params),
      hookDocumentation(hook),
    ],
  };
}

function paramsBlock(params: readonly WordPressParam[]): string[] {
  if (params.length === 0) {
    return [];
  }
  const lines = params.map((param) => {
    const type = param.type === undefined ? '' : ` (${param.type})`;
    const description = param.description === undefined ? '' : `: ${param.description}`;
    return `- \`${param.name}\`${type}${description}`;
  });
  return [`**Parameters**\n\n${lines.join('\n')}`];
}
