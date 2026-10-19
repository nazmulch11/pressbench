import type * as Monaco from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';

import { WP_DATA_FIXTURE } from '@/test/wp-data-fixture';

import { registerWordPressProviders, type ProviderHost } from './providers';

type CompletionProvider = Monaco.languages.CompletionItemProvider;
type HoverProvider = Monaco.languages.HoverProvider;

function fakeHost() {
  const registered: { completion?: CompletionProvider; hover?: HoverProvider } = {};
  const disposed: string[] = [];
  const registerCompletionItemProvider = vi.fn(
    (_language: string, provider: CompletionProvider) => {
      registered.completion = provider;
      return {
        dispose: () => {
          disposed.push('completion');
        },
      };
    },
  );
  const registerHoverProvider = vi.fn((_language: string, provider: HoverProvider) => {
    registered.hover = provider;
    return {
      dispose: () => {
        disposed.push('hover');
      },
    };
  });
  const host = {
    languages: {
      registerCompletionItemProvider,
      registerHoverProvider,
      CompletionItemKind: { Function: 1, Event: 10 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      CompletionItemTag: { Deprecated: 1 },
    },
  } as unknown as ProviderHost;
  return { host, registered, disposed, registerCompletionItemProvider, registerHoverProvider };
}

/** A one-line model with Monaco's word rules for PHP identifiers. */
function fakeModel(line: string): Monaco.editor.ITextModel {
  const wordAt = (column: number) => {
    let start = column - 1;
    while (start > 0 && /[\w$]/.test(line[start - 1] ?? '')) {
      start -= 1;
    }
    let end = column - 1;
    while (end < line.length && /[\w$]/.test(line[end] ?? '')) {
      end += 1;
    }
    return { word: line.slice(start, end), startColumn: start + 1, endColumn: end + 1 };
  };
  const model = {
    getLineContent: () => line,
    getWordUntilPosition: (position: Monaco.Position) => {
      const word = wordAt(position.column);
      return { ...word, word: line.slice(word.startColumn - 1, position.column - 1) };
    },
    getWordAtPosition: (position: Monaco.Position) => {
      const word = wordAt(position.column);
      return word.word === '' ? null : word;
    },
  };
  return model as unknown as Monaco.editor.ITextModel;
}

const position = (column: number): Monaco.Position =>
  ({ lineNumber: 3, column }) as Monaco.Position;
const token = {} as Monaco.CancellationToken;
const context = {} as Monaco.languages.CompletionContext;

async function complete(
  provider: CompletionProvider | undefined,
  line: string,
  column: number,
): Promise<Monaco.languages.CompletionList> {
  const list = await provider?.provideCompletionItems(
    fakeModel(line),
    position(column),
    context,
    token,
  );
  return list!;
}

function hover(
  provider: HoverProvider | undefined,
  line: string,
  column: number,
): Monaco.languages.Hover | null {
  return provider?.provideHover(
    fakeModel(line),
    position(column),
    token,
  ) as Monaco.languages.Hover | null;
}

describe('registerWordPressProviders', () => {
  it('TC-ED-020 registers PHP providers that return Monaco completion items', async () => {
    const { host, registered, disposed, registerCompletionItemProvider, registerHoverProvider } =
      fakeHost();

    const disposable = registerWordPressProviders(host, WP_DATA_FIXTURE);

    expect(registerCompletionItemProvider).toHaveBeenCalledWith(
      'php',
      expect.objectContaining({ triggerCharacters: ["'", '"'] }),
    );
    expect(registerHoverProvider).toHaveBeenCalledWith('php', expect.anything());

    const line = "    add_action( 'ini";
    const list = await complete(registered.completion, line, line.length + 1);
    expect(list.incomplete).toBe(false);
    expect(list.suggestions.map((item) => item.label)).toEqual(['admin_init', 'init']);
    expect(list.suggestions[1]).toEqual({
      label: 'init',
      kind: 10,
      detail: 'WordPress action',
      documentation: { value: expect.stringContaining('Fires after WordPress') as string },
      insertText: 'init',
      sortText: '0init',
      range: { startLineNumber: 3, endLineNumber: 3, startColumn: 18, endColumn: 21 },
    });

    const functions = await complete(registered.completion, 'get_', 5);
    expect(functions.incomplete).toBe(true);
    expect(functions.suggestions.map((item) => item.label)).toEqual([
      'get_option',
      'get_currentuserinfo',
    ]);
    expect(functions.suggestions[0]).toMatchObject({
      kind: 1,
      insertText: 'get_option( $0 )',
      insertTextRules: 4,
      range: { startColumn: 1, endColumn: 5 },
    });
    expect(functions.suggestions[1]).toMatchObject({ tags: [1] });
    expect(functions.suggestions[0]).not.toHaveProperty('tags');

    disposable.dispose();
    expect(disposed).toEqual(['completion', 'hover']);
  });

  it('TC-ED-020a hovers functions and quoted hook names, and nothing else', () => {
    const { host, registered } = fakeHost();
    registerWordPressProviders(host, WP_DATA_FIXTURE);
    const line = "add_action( 'init', 'cb' ); echo $x;";

    const fn = hover(registered.hover, line, 3);
    const hook = hover(registered.hover, line, 15);

    expect(fn).toMatchObject({
      range: { startLineNumber: 3, endLineNumber: 3, startColumn: 1, endColumn: 11 },
    });
    expect(fn?.contents).toHaveLength(3);
    expect(fn?.contents[0]?.value).toContain('add_action( $hook_name');
    expect(hook).toMatchObject({ range: { startColumn: 14, endColumn: 18 } });
    expect(hook?.contents[0]).toEqual({ value: '**init** (WordPress action)' });
    expect(hover(registered.hover, line, 35)).toBeNull();
    expect(hover(registered.hover, line, 32)).toBeNull();
  });
});
