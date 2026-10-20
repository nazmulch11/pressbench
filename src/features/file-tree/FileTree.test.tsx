import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createWorkspaceStore, WorkspaceStoreProvider, type WorkspaceStore } from '@/stores';

import { FileTree } from './FileTree';

const SEED = {
  files: {
    'my-plugin/my-plugin.php': '<?php',
    'my-plugin/readme.txt': 'readme',
    'my-plugin/includes/class-my-plugin.php': 'class',
    'my-plugin/assets/style.css': 'css',
  },
};

function renderTree(): { store: WorkspaceStore; user: ReturnType<typeof userEvent.setup> } {
  const store = createWorkspaceStore({ seed: SEED });
  render(
    <WorkspaceStoreProvider store={store}>
      <FileTree />
    </WorkspaceStoreProvider>,
  );
  return { store, user: userEvent.setup() };
}

const item = (name: string) => screen.getByRole('treeitem', { name });

describe('FileTree', () => {
  it('TC-WS-017 moves a file with the keyboard through the context menu', async () => {
    const { store, user } = renderTree();

    item('readme.txt').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Destination folder' }),
      'my-plugin/includes',
    );
    await user.click(screen.getByRole('button', { name: 'Move' }));

    expect(item('readme.txt')).toHaveAttribute('data-path', 'my-plugin/includes/readme.txt');
    expect(item('readme.txt')).toHaveAttribute('aria-level', '3');
    expect(store.getState().fs.exists('my-plugin/includes/readme.txt')).toBe(true);
    expect(item('readme.txt')).toHaveFocus();
    expect(screen.getByText('Moved readme.txt to my-plugin/includes')).toBeInTheDocument();
  });

  it('TC-WS-022 keeps the input and explains when a new name exists or is invalid', async () => {
    const { store, user } = renderTree();

    await user.pointer({ keys: '[MouseRight]', target: item('my-plugin') });
    await user.click(screen.getByRole('menuitem', { name: 'New file' }));
    const input = screen.getByRole('textbox', { name: 'New file name' });
    await user.type(input, 'my-plugin.php{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('already exists');
    expect(input).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'a/b{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('slashes');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(store.getState().entries.map((entry) => entry.path)).not.toContain('my-plugin/a/b');
    expect(store.getState().tabs).toEqual([]);
  });

  it('TC-WS-022a creates a folder from the root menu and expands it', async () => {
    const { store, user } = renderTree();

    fireEvent.contextMenu(screen.getByRole('tree', { name: 'Files' }));
    await user.click(screen.getByRole('menuitem', { name: 'New folder' }));
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'docs{Enter}');

    expect(store.getState().fs.stat('docs')).toBe('directory');
    expect(item('docs')).toHaveAttribute('aria-expanded', 'true');
    expect(item('docs')).toHaveFocus();
  });

  it('TC-WS-008c arrow keys walk the tree, Enter opens, and Escape leaves rename in place', async () => {
    const { store, user } = renderTree();

    item('my-plugin').focus();
    await user.keyboard('{ArrowLeft}');
    expect(item('my-plugin')).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(item('assets')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowDown}');
    expect(item('includes')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('class-my-plugin.php')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(store.getState().activeTab).toBe('my-plugin/includes/class-my-plugin.php');
    expect(item('class-my-plugin.php')).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{F2}');
    const input = screen.getByRole('textbox', { name: 'New name' });
    expect(input).toHaveValue('class-my-plugin.php');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(item('class-my-plugin.php')).toHaveFocus();
    await user.keyboard('{End}');
    expect(item('readme.txt')).toHaveFocus();
    await user.keyboard('{Home}{ArrowLeft}{ArrowLeft}');
    expect(item('my-plugin')).toHaveAttribute('aria-expanded', 'false');
  });

  it('TC-WS-008d Delete asks, Escape cancels, and the confirm removes the file', async () => {
    const { store, user } = renderTree();

    item('readme.txt').focus();
    await user.keyboard('{Delete}');
    expect(screen.getByRole('alertdialog', { name: 'Delete readme.txt?' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(item('readme.txt')).toHaveFocus();

    await user.keyboard('{Delete}');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(store.getState().fs.exists('my-plugin/readme.txt')).toBe(false);
    expect(screen.queryByRole('treeitem', { name: 'readme.txt' })).not.toBeInTheDocument();
    expect(item('my-plugin.php')).toHaveFocus();
  });

  it('TC-WS-008g a dialog opened from the context menu gets the focus, and the row gets it back', async () => {
    const { user } = renderTree();

    item('readme.txt').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(screen.getByRole('menuitem', { name: /^Delete/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete readme.txt?' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(item('readme.txt')).toHaveFocus();

    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    expect(screen.getByRole('combobox', { name: 'Destination folder' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(item('readme.txt')).toHaveFocus();
  });

  it('TC-WS-008h deleting an expanded folder moves the focus to the next row after it', async () => {
    const { store, user } = renderTree();

    item('assets').focus();
    await user.keyboard('{Delete}');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(store.getState().fs.exists('my-plugin/assets')).toBe(false);
    expect(item('includes')).toHaveFocus();
  });

  it('TC-WS-007a drags a file onto a folder with pointer events', () => {
    const { store } = renderTree();
    const file = item('readme.txt');
    const folder = item('assets');

    fireEvent.pointerDown(file, { button: 0, clientX: 10, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(folder, { clientX: 10, clientY: 50, pointerId: 1 });
    expect(folder).toHaveAttribute('data-drop-target', 'true');
    fireEvent.pointerUp(window, { clientX: 10, clientY: 50, pointerId: 1 });

    expect(store.getState().fs.exists('my-plugin/assets/readme.txt')).toBe(true);
    expect(item('readme.txt')).toHaveAttribute('data-path', 'my-plugin/assets/readme.txt');
  });

  it('TC-WS-007b ignores drops on the file’s own folder, itself and a short press', () => {
    const { store } = renderTree();
    const file = item('readme.txt');

    fireEvent.pointerDown(file, { button: 0, clientX: 10, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 11, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 11, clientY: 100, pointerId: 1 });
    fireEvent.pointerDown(file, { button: 0, clientX: 10, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(item('my-plugin.php'), { clientX: 10, clientY: 10, pointerId: 1 });
    expect(item('my-plugin')).not.toHaveAttribute('data-drop-target');
    fireEvent.pointerUp(window, { clientX: 10, clientY: 10, pointerId: 1 });

    expect(store.getState().fs.exists('my-plugin/readme.txt')).toBe(true);
    expect(store.getState().entries).toHaveLength(7);
  });

  it('TC-WS-004a renames a folder and keeps it expanded', async () => {
    const { store, user } = renderTree();

    item('includes').focus();
    await user.keyboard('{F2}');
    await user.clear(screen.getByRole('textbox', { name: 'New name' }));
    await user.type(screen.getByRole('textbox', { name: 'New name' }), 'inc{Enter}');

    expect(store.getState().fs.exists('my-plugin/inc/class-my-plugin.php')).toBe(true);
    expect(item('inc')).toHaveAttribute('aria-expanded', 'true');
    expect(item('inc')).toHaveFocus();
  });

  it('TC-WS-011a reacts to new-file and rename requests from the store', async () => {
    const { store, user } = renderTree();

    store.getState().requestTreeAction({ kind: 'new-file', parent: 'my-plugin/assets' });
    const input = await screen.findByRole('textbox', { name: 'New file name' });
    await user.type(input, 'app.js{Enter}');
    expect(store.getState().tabs).toEqual(['my-plugin/assets/app.js']);

    store.getState().requestTreeAction({ kind: 'rename', path: 'my-plugin/assets/app.js' });

    expect(await screen.findByRole('textbox', { name: 'New name' })).toHaveValue('app.js');
  });

  it('TC-PRJ-017 reveals an imported project: folders expanded, main file selected and focused', () => {
    const { store } = renderTree();

    act(() => {
      store
        .getState()
        .importProject(
          'hello',
          { 'hello/src/admin/hello.php': '<?php', 'hello/readme.txt': 'Hi' },
          'hello/src/admin/hello.php',
        );
    });

    expect(item('hello')).toHaveAttribute('aria-expanded', 'true');
    expect(item('src')).toHaveAttribute('aria-expanded', 'true');
    expect(item('admin')).toHaveAttribute('aria-expanded', 'true');
    expect(item('hello.php')).toHaveAttribute('aria-selected', 'true');
    expect(item('hello.php')).toHaveFocus();
    expect(store.getState().treeRequest).toBeNull();
  });

  it('TC-PRJ-017a reveals an import made while the tree was hidden once the tree is shown', () => {
    const store = createWorkspaceStore({ seed: SEED });
    store
      .getState()
      .importProject('later', { 'later/inc/later.php': '<?php' }, 'later/inc/later.php');

    render(
      <WorkspaceStoreProvider store={store}>
        <FileTree />
      </WorkspaceStoreProvider>,
    );

    expect(item('later.php')).toHaveAttribute('aria-selected', 'true');
    expect(item('later.php')).toHaveFocus();
    expect(store.getState().treeRequest).toBeNull();
  });
});
