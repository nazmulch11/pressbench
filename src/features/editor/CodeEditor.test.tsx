import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatSource } from '@/lib/format';
import { ok } from '@/lib/result';
import { createWorkspaceStore, WorkspaceStoreProvider, type WorkspaceStore } from '@/stores';
import { WP_DATA_FIXTURE } from '@/test/wp-data-fixture';

import { CodeEditor } from './CodeEditor';

interface FakeModel {
  readonly uri: { readonly path: string };
  readonly dispose: ReturnType<typeof vi.fn>;
  getValue(): string;
  getFullModelRange(): string;
}

interface FakeAction {
  readonly id: string;
  readonly keybindings?: readonly number[];
  run(editor: unknown): unknown;
}

interface EditorProps {
  path: string;
  theme: string;
  value: string;
  options: { ariaLabel: string };
  onMount: (editor: unknown, monaco: unknown) => void;
  onChange: (value: string) => void;
}

/** Shared with the hoisted module mocks: one fake Monaco world per test. */
const world = vi.hoisted(() => {
  const models = new Map<string, FakeModel>();
  const actions = new Map<string, FakeAction>();
  const props: EditorProps[] = [];
  let value = '';
  const fakeEditor = {
    addAction: (action: FakeAction) => {
      actions.set(action.id, action);
      return { dispose: () => undefined };
    },
    getAction: (id: string) => {
      const action = actions.get(id);
      return action === undefined ? null : { run: () => action.run(fakeEditor) };
    },
    getModel: () => models.get(props.at(-1)?.path ?? '') ?? null,
    executeEdits: vi.fn(),
    pushUndoStop: vi.fn(),
  };
  const fakeMonaco = {
    KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512, WinCtrl: 256 },
    KeyCode: { KeyS: 49, KeyF: 36, KeyK: 41 },
    languages: {
      registerCompletionItemProvider: vi.fn(() => ({ dispose: () => undefined })),
      registerHoverProvider: vi.fn(() => ({ dispose: () => undefined })),
      CompletionItemKind: { Function: 1, Event: 10 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      CompletionItemTag: { Deprecated: 1 },
    },
    editor: { getModels: () => [...models.values()] },
  };
  return {
    models,
    actions,
    props,
    fakeEditor,
    fakeMonaco,
    setValue: (next: string) => {
      value = next;
    },
    getValue: () => value,
    reset: () => {
      models.clear();
      actions.clear();
      props.length = 0;
      value = '';
    },
  };
});

vi.mock('./monaco-environment', () => ({}));
vi.mock('@/lib/format', { spy: true });
vi.mock('@/lib/wp-data', () => ({
  loadWordPressData: () => Promise.resolve(ok(WP_DATA_FIXTURE)),
}));
vi.mock('@monaco-editor/react', () => ({
  Editor: (props: EditorProps) => {
    world.props.push(props);
    world.setValue(props.value);
    if (!world.models.has(props.path)) {
      world.models.set(props.path, {
        uri: { path: props.path.replace('file://', '') },
        dispose: vi.fn(),
        getValue: () => world.getValue(),
        getFullModelRange: () => 'full-range',
      });
    }
    const { onMount } = props;
    useEffect(() => {
      onMount(world.fakeEditor, world.fakeMonaco);
    }, [onMount]);
    return (
      <textarea
        aria-label={props.options.ariaLabel}
        data-theme={props.theme}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    );
  },
}));

function renderEditor(): { store: WorkspaceStore; user: ReturnType<typeof userEvent.setup> } {
  const store = createWorkspaceStore();
  render(
    <WorkspaceStoreProvider store={store}>
      <CodeEditor />
    </WorkspaceStoreProvider>,
  );
  return { store, user: userEvent.setup() };
}

function mockMatchMedia(dark: boolean): void {
  const media = {
    matches: dark,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  vi.stubGlobal('matchMedia', () => media);
}

const editor = (path: string) => screen.findByRole('textbox', { name: `Editor: ${path}` });

describe('CodeEditor', () => {
  beforeEach(() => {
    world.reset();
    mockMatchMedia(false);
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it('TC-ED-019 mounts Monaco for the active file, registers providers once and saves through the action', async () => {
    const { store, user } = renderEditor();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    act(() => {
      store.getState().openFile('my-plugin/readme.txt');
    });

    const textbox = await editor('my-plugin/readme.txt');
    expect(world.props.at(-1)).toMatchObject({
      path: 'file:///my-plugin/readme.txt',
      theme: 'vs',
    });
    await waitFor(() => {
      expect(world.fakeMonaco.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);
    });
    expect(world.fakeMonaco.languages.registerHoverProvider).toHaveBeenCalledTimes(1);

    await user.type(textbox, 'Edited: ');
    expect(store.getState().drafts['my-plugin/readme.txt']).toMatch(/Edited: $/);

    const save = world.actions.get('pressbench.save');
    expect(save?.keybindings).toEqual([2048 | 49]);
    act(() => {
      save?.run(world.fakeEditor);
    });
    expect(store.getState().drafts['my-plugin/readme.txt']).toBeUndefined();
    expect(store.getState().fs.read('my-plugin/readme.txt')).toMatchObject({
      ok: true,
      value: expect.stringMatching(/Edited: $/) as string,
    });

    act(() => {
      store.getState().openFile('my-plugin/my-plugin.php');
    });
    await editor('my-plugin/my-plugin.php');
    expect(world.fakeMonaco.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);

    const commands = world.actions.get('pressbench.commands');
    // Cmd/Ctrl+K and plain Ctrl+K: Monaco takes Ctrl+K for itself when the browser reports macOS (TC-ED-025).
    expect(commands?.keybindings).toEqual([2048 | 41, 256 | 41]);
    act(() => {
      commands?.run(world.fakeEditor);
    });
    expect(store.getState().isPaletteOpen).toBe(true);
  });

  it('TC-ED-019a disposes the models of closed, renamed and deleted files', async () => {
    const { store } = renderEditor();
    for (const path of [
      'my-plugin/readme.txt',
      'my-plugin/assets/style.css',
      'my-plugin/my-plugin.php',
    ]) {
      act(() => {
        store.getState().openFile(path);
      });
      await editor(path);
    }
    const model = (path: string) => world.models.get(`file:///${path}`);
    expect([...world.models.keys()]).toHaveLength(3);

    act(() => {
      store.getState().closeTab('my-plugin/readme.txt');
    });
    expect(model('my-plugin/readme.txt')?.dispose).toHaveBeenCalledTimes(1);
    expect(model('my-plugin/assets/style.css')?.dispose).not.toHaveBeenCalled();

    act(() => {
      store.getState().renameEntry('my-plugin/assets/style.css', 'main.css');
    });
    expect(model('my-plugin/assets/style.css')?.dispose).toHaveBeenCalled();
    expect(model('my-plugin/my-plugin.php')?.dispose).not.toHaveBeenCalled();

    act(() => {
      store.getState().removeEntry('my-plugin');
    });
    expect(model('my-plugin/my-plugin.php')?.dispose).toHaveBeenCalled();
  });

  it('TC-ED-019b formats a CSS file from a palette request and explains when a file cannot be formatted', async () => {
    const { store } = renderEditor();
    act(() => {
      store.getState().fs.write('my-plugin/assets/style.css', '.a{color:red}');
      store.getState().openFile('my-plugin/assets/style.css');
    });
    await editor('my-plugin/assets/style.css');
    expect(world.actions.get('pressbench.format')?.keybindings).toEqual([1024 | 512 | 36]);

    act(() => {
      store.getState().requestEditorAction({ kind: 'format' });
    });

    expect(store.getState().editorRequest).toBeNull();
    await waitFor(() => {
      expect(world.fakeEditor.executeEdits).toHaveBeenCalledWith('format', [
        { range: 'full-range', text: '.a {\n\tcolor: red;\n}\n' },
      ]);
    });
    expect(world.fakeEditor.pushUndoStop).toHaveBeenCalledTimes(1);

    act(() => {
      store.getState().openFile('my-plugin/my-plugin.php');
    });
    await editor('my-plugin/my-plugin.php');
    act(() => {
      store.getState().requestEditorAction({ kind: 'format' });
    });

    await screen.findByText(/Formatting is not available for this file type yet/);
    expect(world.fakeEditor.executeEdits).toHaveBeenCalledTimes(1);
  });

  it('TC-ED-019c drops a format result when the user switched files while Prettier loaded', async () => {
    const { store } = renderEditor();
    act(() => {
      store.getState().fs.write('my-plugin/assets/style.css', '.a{color:red}');
      store.getState().openFile('my-plugin/assets/style.css');
    });
    await editor('my-plugin/assets/style.css');

    act(() => {
      store.getState().requestEditorAction({ kind: 'format' });
      store.getState().openFile('my-plugin/readme.txt');
    });
    await editor('my-plugin/readme.txt');

    await waitFor(() => {
      expect(screen.getByRole('textbox').closest('[data-wp-data]')).toHaveAttribute(
        'data-wp-data',
        'ready',
      );
    });
    await waitFor(() => {
      expect(vi.mocked(formatSource)).toHaveBeenCalledTimes(1);
    });
    await vi.mocked(formatSource).mock.results[0]?.value;
    expect(world.fakeEditor.executeEdits).not.toHaveBeenCalled();
    expect(store.getState().drafts['my-plugin/assets/style.css']).toBeUndefined();
  });

  it('TC-ED-022 follows the colour scheme: system preference, then a forced data-theme', async () => {
    mockMatchMedia(true);
    const { store } = renderEditor();
    act(() => {
      store.getState().openFile('my-plugin/readme.txt');
    });

    const textbox = await editor('my-plugin/readme.txt');
    expect(textbox).toHaveAttribute('data-theme', 'vs-dark');

    document.documentElement.dataset.theme = 'light';
    await waitFor(() => {
      expect(textbox).toHaveAttribute('data-theme', 'vs');
    });
  });
});
