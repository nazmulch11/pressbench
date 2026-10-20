import { describe, expect, it, vi } from 'vitest';

import { createPreferences } from '@/lib/storage';

import { LAYOUT_LIMITS } from './layout';
import { createWorkspaceStore } from './workspace-store';

const SEED = {
  files: {
    'plugin/plugin.php': '<?php',
    'plugin/readme.txt': 'readme',
    'plugin/inc/class-a.php': 'class A {}',
    'plugin/inc/class-b.php': 'class B {}',
  },
};

function makeStore(preferences = createPreferences(null)) {
  return createWorkspaceStore({ seed: SEED, preferences });
}

describe('workspace store: layout', () => {
  it('TC-WS-015 clamps panel sizes and persists sizes and visibility', () => {
    const preferences = createPreferences(null);
    const store = makeStore(preferences);

    store.getState().setPanelSize('sidebar', 20);
    expect(store.getState().layout.sizes.sidebar).toBe(LAYOUT_LIMITS.sidebar.min);
    store.getState().setPanelSize('sidebar', 5000);
    expect(store.getState().layout.sizes.sidebar).toBe(LAYOUT_LIMITS.sidebar.max);
    store.getState().setPanelSize('sidebar', 333);
    store.getState().togglePanel('preview');

    const second = makeStore(preferences);

    expect(second.getState().layout.sizes.sidebar).toBe(333);
    expect(second.getState().layout.visible.preview).toBe(false);
  });

  it('TC-WS-015c a size set without persist shows at once but is not stored', () => {
    const preferences = createPreferences(null);
    const store = makeStore(preferences);

    store.getState().setPanelSize('sidebar', 300, false);

    expect(store.getState().layout.sizes.sidebar).toBe(300);
    expect(makeStore(preferences).getState().layout.sizes.sidebar).toBe(
      LAYOUT_LIMITS.sidebar.default,
    );
    store.getState().setPanelSize('sidebar', 300);
    expect(makeStore(preferences).getState().layout.sizes.sidebar).toBe(300);
  });

  it('TC-WS-015a reset layout restores the defaults and forgets the stored values', () => {
    const preferences = createPreferences(null);
    const store = makeStore(preferences);
    store.getState().setPanelSize('bottom', 400);
    store.getState().togglePanel('sidebar');

    store.getState().resetLayout();

    expect(store.getState().layout.sizes.bottom).toBe(LAYOUT_LIMITS.bottom.default);
    expect(store.getState().layout.visible.sidebar).toBe(true);
    expect(makeStore(preferences).getState().layout.sizes.bottom).toBe(
      LAYOUT_LIMITS.bottom.default,
    );
  });

  it('TC-WS-015b ignores stored values that are not numbers or booleans', () => {
    const preferences = createPreferences(null);
    preferences.set('layout', { sizes: { sidebar: 'wide' }, visible: { preview: 'no' } });

    const store = makeStore(preferences);

    expect(store.getState().layout.sizes.sidebar).toBe(LAYOUT_LIMITS.sidebar.default);
    expect(store.getState().layout.visible.preview).toBe(true);
  });
});

describe('workspace store: tabs follow the project', () => {
  it('TC-WS-021 moves tab paths and drafts when a file is renamed', () => {
    const store = makeStore();
    store.getState().openFile('plugin/readme.txt');
    store.getState().setDraft('plugin/readme.txt', 'edited');

    const renamed = store.getState().renameEntry('plugin/readme.txt', 'readme.md');

    expect(renamed).toEqual({ ok: true, value: 'plugin/readme.md' });
    expect(store.getState().tabs).toEqual(['plugin/readme.md']);
    expect(store.getState().activeTab).toBe('plugin/readme.md');
    expect(store.getState().drafts).toEqual({ 'plugin/readme.md': 'edited' });
  });

  it('TC-WS-021a moves every tab under a renamed folder', () => {
    const store = makeStore();
    store.getState().openFile('plugin/inc/class-a.php');
    store.getState().openFile('plugin/inc/class-b.php');
    store.getState().openFile('plugin/plugin.php');

    store.getState().renameEntry('plugin/inc', 'includes');

    expect(store.getState().tabs).toEqual([
      'plugin/includes/class-a.php',
      'plugin/includes/class-b.php',
      'plugin/plugin.php',
    ]);
    expect(store.getState().activeTab).toBe('plugin/plugin.php');
  });

  it('TC-WS-021b moves a file into another folder and keeps its tab', () => {
    const store = makeStore();
    store.getState().openFile('plugin/readme.txt');

    const moved = store.getState().moveEntry('plugin/readme.txt', 'plugin/inc');

    expect(moved).toEqual({ ok: true, value: 'plugin/inc/readme.txt' });
    expect(store.getState().tabs).toEqual(['plugin/inc/readme.txt']);
    expect(store.getState().fs.exists('plugin/readme.txt')).toBe(false);
  });

  it('TC-WS-021c closes the tabs and drops the drafts of a removed folder', () => {
    const store = makeStore();
    store.getState().openFile('plugin/inc/class-a.php');
    store.getState().openFile('plugin/plugin.php');
    store.getState().openFile('plugin/inc/class-b.php');
    store.getState().setDraft('plugin/inc/class-b.php', 'draft');

    store.getState().removeEntry('plugin/inc');

    expect(store.getState().tabs).toEqual(['plugin/plugin.php']);
    expect(store.getState().activeTab).toBe('plugin/plugin.php');
    expect(store.getState().drafts).toEqual({});
  });

  it('TC-WS-021d reports project errors as results and leaves tabs alone', () => {
    const store = makeStore();
    store.getState().openFile('plugin/readme.txt');

    expect(store.getState().renameEntry('plugin/readme.txt', 'a/b')).toMatchObject({
      ok: false,
      error: { kind: 'invalid-path' },
    });
    expect(store.getState().moveEntry('plugin/readme.txt', 'plugin')).toEqual({
      ok: true,
      value: 'plugin/readme.txt',
    });
    store.getState().fs.write('plugin/inc/readme.txt', 'other');
    expect(store.getState().moveEntry('plugin/readme.txt', 'plugin/inc')).toMatchObject({
      ok: false,
      error: { kind: 'exists' },
    });
    expect(store.getState().createFile('plugin', 'readme.txt')).toMatchObject({
      ok: false,
      error: { kind: 'exists' },
    });
    expect(store.getState().tabs).toEqual(['plugin/readme.txt']);
  });
});

describe('workspace store: tabs', () => {
  it('TC-WS-021e opens a file once, activates it, and picks the neighbour when closing', () => {
    const store = makeStore();
    const { openFile, closeTab } = store.getState();

    openFile('plugin/plugin.php');
    openFile('plugin/readme.txt');
    openFile('plugin/inc/class-a.php');
    openFile('plugin/readme.txt');
    expect(store.getState().tabs).toEqual([
      'plugin/plugin.php',
      'plugin/readme.txt',
      'plugin/inc/class-a.php',
    ]);
    expect(store.getState().activeTab).toBe('plugin/readme.txt');

    expect(closeTab('plugin/readme.txt')).toBe('closed');
    expect(store.getState().activeTab).toBe('plugin/inc/class-a.php');
    closeTab('plugin/inc/class-a.php');
    expect(store.getState().activeTab).toBe('plugin/plugin.php');
    closeTab('plugin/plugin.php');
    expect(store.getState().activeTab).toBeNull();
  });

  it('TC-WS-021f asks before closing an edited tab, then saves or discards', () => {
    const store = makeStore();
    store.getState().openFile('plugin/readme.txt');
    store.getState().setDraft('plugin/readme.txt', 'edited');

    expect(store.getState().closeTab('plugin/readme.txt')).toBe('needs-confirm');
    expect(store.getState().closing).toBe('plugin/readme.txt');
    store.getState().cancelClose();
    expect(store.getState().closing).toBeNull();
    expect(store.getState().tabs).toEqual(['plugin/readme.txt']);

    store.getState().closeTab('plugin/readme.txt');
    store.getState().discardAndClose('plugin/readme.txt');
    expect(store.getState().tabs).toEqual([]);
    expect(store.getState().fs.read('plugin/readme.txt')).toEqual({ ok: true, value: 'readme' });

    store.getState().openFile('plugin/readme.txt');
    store.getState().setDraft('plugin/readme.txt', 'edited again');
    store.getState().closeTab('plugin/readme.txt');
    store.getState().saveAndClose('plugin/readme.txt');
    expect(store.getState().tabs).toEqual([]);
    expect(store.getState().fs.read('plugin/readme.txt')).toEqual({
      ok: true,
      value: 'edited again',
    });
  });

  it('TC-WS-021g a draft equal to the saved content is not a draft', () => {
    const store = makeStore();
    store.getState().openFile('plugin/readme.txt');

    store.getState().setDraft('plugin/readme.txt', 'x');
    store.getState().setDraft('plugin/readme.txt', 'readme');

    expect(store.getState().drafts).toEqual({});
    expect(store.getState().saveFile('plugin/readme.txt')).toEqual({ ok: true, value: undefined });
  });

  it('TC-WS-021h reorders tabs and keeps the active one', () => {
    const store = makeStore();
    store.getState().openFile('plugin/plugin.php');
    store.getState().openFile('plugin/readme.txt');
    store.getState().openFile('plugin/inc/class-a.php');
    store.getState().activateTab('plugin/plugin.php');

    store.getState().moveTab('plugin/plugin.php', 2);
    expect(store.getState().tabs).toEqual([
      'plugin/readme.txt',
      'plugin/inc/class-a.php',
      'plugin/plugin.php',
    ]);
    store.getState().moveTab('plugin/plugin.php', 0);
    expect(store.getState().tabs).toEqual([
      'plugin/plugin.php',
      'plugin/readme.txt',
      'plugin/inc/class-a.php',
    ]);
    store.getState().moveTab('plugin/plugin.php', -1);
    store.getState().moveTab('nope', 1);
    expect(store.getState().tabs[0]).toBe('plugin/plugin.php');
    expect(store.getState().activeTab).toBe('plugin/plugin.php');
  });

  it('TC-WS-021i create file opens it, create folder does not, and tree requests round-trip', () => {
    const store = makeStore();

    expect(store.getState().createFile('plugin', 'a.php')).toEqual({
      ok: true,
      value: 'plugin/a.php',
    });
    expect(store.getState().createFolder('plugin', 'lib')).toEqual({
      ok: true,
      value: 'plugin/lib',
    });
    expect(store.getState().tabs).toEqual(['plugin/a.php']);
    expect(store.getState().fs.stat('plugin/lib')).toBe('directory');

    store.getState().requestTreeAction({ kind: 'new-file', parent: 'plugin' });
    expect(store.getState().treeRequest).toMatchObject({ kind: 'new-file', parent: 'plugin' });
    store.getState().clearTreeRequest();
    expect(store.getState().treeRequest).toBeNull();
    store.getState().openPalette();
    expect(store.getState().isPaletteOpen).toBe(true);
    store.getState().closePalette();
    expect(store.getState().isPaletteOpen).toBe(false);
  });
});

describe('workspace store: editor requests', () => {
  it('TC-ED-023 holds a format request with a new serial each time until it is cleared', () => {
    const store = makeStore();

    store.getState().requestEditorAction({ kind: 'format' });
    const first = store.getState().editorRequest;
    store.getState().requestEditorAction({ kind: 'format' });
    const second = store.getState().editorRequest;

    expect(first).toMatchObject({ kind: 'format' });
    expect(second).toMatchObject({ kind: 'format' });
    expect(second?.serial).toBeGreaterThan(first?.serial ?? Number.NaN);
    store.getState().clearEditorRequest();
    expect(store.getState().editorRequest).toBeNull();
  });

  it('TC-ED-023a the Format document command does nothing without an open file', async () => {
    const { WORKSPACE_COMMANDS } = await import('@/features/workspace');
    const format = WORKSPACE_COMMANDS.find((command) => command.id === 'editor.format');
    const store = makeStore();

    format?.run(store.getState());
    expect(store.getState().editorRequest).toBeNull();

    store.getState().openFile('plugin/plugin.php');
    format?.run(store.getState());
    expect(store.getState().editorRequest).toMatchObject({ kind: 'format' });
  });
});

describe('workspace store: importing a project', () => {
  const FILES = {
    'hello/hello.php': '<?php /* Plugin Name: Hello */',
    'hello/assets/style.css': '.a {}',
  };

  it('TC-PRJ-015a writes every file and opens the main file', () => {
    const store = makeStore();

    const result = store.getState().importProject('hello', FILES, 'hello/hello.php');

    expect(result).toEqual({ ok: true, value: 'hello' });
    expect(store.getState().fs.read('hello/hello.php')).toEqual({
      ok: true,
      value: FILES['hello/hello.php'],
    });
    expect(store.getState().fs.read('hello/assets/style.css')).toEqual({
      ok: true,
      value: '.a {}',
    });
    expect(store.getState().entries.map((entry) => entry.path)).toContain('hello/assets');
    expect(store.getState().activeTab).toBe('hello/hello.php');
    expect(store.getState().treeSelection).toBe('hello/hello.php');
    expect(store.getState().treeRequest).toMatchObject({ kind: 'reveal', path: 'hello/hello.php' });
  });

  it('TC-PRJ-015b refuses a folder that already exists and changes nothing', () => {
    const store = makeStore();
    const before = store.getState().fs.entries();

    const result = store
      .getState()
      .importProject('plugin', { 'plugin/new.php': '<?php' }, 'plugin/new.php');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'exists',
        path: 'plugin',
        message: 'A folder named "plugin" already exists. Rename or delete it, then upload again.',
      },
    });
    expect(store.getState().fs.entries()).toEqual(before);
    expect(store.getState().tabs).toEqual([]);
  });

  it('TC-PRJ-015c refuses files outside the folder and leaves nothing behind', () => {
    const store = makeStore();
    const before = store.getState().fs.entries();

    const result = store
      .getState()
      .importProject('hello', { 'hello/a.php': '<?php', 'other/b.php': '<?php' }, 'hello/a.php');

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalid-path', path: 'other/b.php' },
    });
    expect(store.getState().fs.entries()).toEqual(before);
  });

  it('TC-PRJ-015d removes a half-written folder when a write throws, and reports it', () => {
    const store = makeStore();
    const before = store.getState().fs.entries();
    const fs = store.getState().fs;
    const write = fs.write.bind(fs);
    let calls = 0;
    vi.spyOn(fs, 'write').mockImplementation((path, content) => {
      calls += 1;
      if (calls === 2) {
        throw new RangeError('Maximum call stack size exceeded');
      }
      return write(path, content);
    });

    const result = store
      .getState()
      .importProject('hello', { 'hello/a.php': '<?php', 'hello/b.php': '<?php' }, 'hello/a.php');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-path',
        path: 'hello',
        message: 'The project could not be added: Maximum call stack size exceeded',
      },
    });
    expect(store.getState().fs.entries()).toEqual(before);
    expect(store.getState().tabs).toEqual([]);
  });

  it('TC-PRJ-015e refuses a folder whose name differs only in case from an existing one', () => {
    const store = makeStore();
    const before = store.getState().fs.entries();

    const result = store
      .getState()
      .importProject('Plugin', { 'Plugin/p.php': '<?php' }, 'Plugin/p.php');

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'exists',
        message:
          'A folder named "plugin" already exists (names are compared without case). Rename or delete it, then upload again.',
      },
    });
    expect(store.getState().fs.entries()).toEqual(before);
  });

  it('TC-PRJ-015f refreshes the file list once per import, not once per file', () => {
    const store = makeStore();
    const files: Record<string, string> = {};
    for (let index = 0; index < 50; index += 1) {
      files[`big/f${String(index)}.php`] = '<?php';
    }
    let entryUpdates = 0;
    store.subscribe((state, previous) => {
      if (state.entries !== previous.entries) {
        entryUpdates += 1;
      }
    });

    store.getState().importProject('big', files, 'big/f0.php');

    expect(entryUpdates).toBe(1);
    expect(store.getState().entries.filter((entry) => entry.path.startsWith('big/'))).toHaveLength(
      50,
    );
  });
});
