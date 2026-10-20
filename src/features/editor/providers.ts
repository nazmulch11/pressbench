import type * as Monaco from 'monaco-editor';

import type { WordPressData } from '@/lib/wp-data';

import { suggest, type Suggestion } from './completion';
import { hookAtPosition } from './hook-context';
import { functionHover, hookHover, type HoverContent } from './hover';

/**
 * The slice of the Monaco API the providers need. Narrow on purpose, so unit tests can pass a fake and the
 * real `monaco` namespace still fits.
 */
export interface ProviderHost {
  readonly languages: {
    registerCompletionItemProvider(
      languageId: string,
      provider: Monaco.languages.CompletionItemProvider,
    ): Monaco.IDisposable;
    registerHoverProvider(
      languageId: string,
      provider: Monaco.languages.HoverProvider,
    ): Monaco.IDisposable;
    readonly CompletionItemKind: Pick<
      typeof Monaco.languages.CompletionItemKind,
      'Function' | 'Event'
    >;
    readonly CompletionItemInsertTextRule: Pick<
      typeof Monaco.languages.CompletionItemInsertTextRule,
      'InsertAsSnippet'
    >;
    readonly CompletionItemTag: Pick<typeof Monaco.languages.CompletionItemTag, 'Deprecated'>;
  };
}

/** Registers WordPress completion and hover for PHP. Dispose the result to remove both. */
export function registerWordPressProviders(
  monaco: ProviderHost,
  data: WordPressData,
): Monaco.IDisposable {
  const completion = monaco.languages.registerCompletionItemProvider('php', {
    triggerCharacters: ["'", '"'],
    provideCompletionItems: (model, position) => completionItems(monaco, data, model, position),
  });
  const hover = monaco.languages.registerHoverProvider('php', {
    provideHover: (model, position) => hoverAt(data, model, position),
  });
  return {
    dispose() {
      completion.dispose();
      hover.dispose();
    },
  };
}

function completionItems(
  monaco: ProviderHost,
  data: WordPressData,
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
): Monaco.languages.CompletionList {
  const line = model.getLineContent(position.lineNumber);
  const word = model.getWordUntilPosition(position);
  const result = suggest(
    {
      lineBeforeCursor: line.slice(0, position.column - 1),
      lineAfterCursor: line.slice(position.column - 1),
      word: word.word,
      wordStartColumn: word.startColumn,
    },
    data,
  );
  return {
    incomplete: result.incomplete,
    suggestions: result.suggestions.map((suggestion) =>
      toCompletionItem(monaco, suggestion, position),
    ),
  };
}

function toCompletionItem(
  monaco: ProviderHost,
  suggestion: Suggestion,
  position: Monaco.Position,
): Monaco.languages.CompletionItem {
  const { CompletionItemKind, CompletionItemInsertTextRule, CompletionItemTag } = monaco.languages;
  return {
    label: suggestion.label,
    kind: suggestion.kind === 'function' ? CompletionItemKind.Function : CompletionItemKind.Event,
    detail: suggestion.detail,
    documentation: { value: suggestion.documentation },
    insertText: suggestion.insertText,
    ...(suggestion.isSnippet
      ? { insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet }
      : {}),
    sortText: suggestion.sortText,
    ...(suggestion.deprecated ? { tags: [CompletionItemTag.Deprecated] } : {}),
    range: {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: suggestion.startColumn,
      endColumn: position.column,
    },
  };
}

function hoverAt(
  data: WordPressData,
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
): Monaco.languages.Hover | null {
  const line = model.getLineContent(position.lineNumber);
  const hook = hookAtPosition(line, position.column);
  if (hook !== null) {
    return toHover(hookHover(hook.name, hook.type, data), position, hook);
  }
  const word = model.getWordAtPosition(position);
  if (word === null) {
    return null;
  }
  return toHover(functionHover(word.word, data), position, word);
}

function toHover(
  content: HoverContent | null,
  position: Monaco.Position,
  span: { readonly startColumn: number; readonly endColumn: number },
): Monaco.languages.Hover | null {
  if (content === null) {
    return null;
  }
  return {
    contents: content.contents.map((value) => ({ value })),
    range: {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: span.startColumn,
      endColumn: span.endColumn,
    },
  };
}
