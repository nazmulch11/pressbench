import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createWorkspaceStore, WorkspaceStoreProvider } from '@/stores';

import { CommandPalette } from './CommandPalette';
import { filterCommands, WORKSPACE_COMMANDS, type Command } from './commands';

function renderPalette(commands?: readonly Command[]) {
  const store = createWorkspaceStore();
  render(
    <WorkspaceStoreProvider store={store}>
      <button
        type="button"
        onClick={() => {
          store.getState().openPalette();
        }}
      >
        Open palette
      </button>
      <CommandPalette {...(commands === undefined ? {} : { commands })} />
    </WorkspaceStoreProvider>,
  );
  return { store, user: userEvent.setup() };
}

describe('CommandPalette', () => {
  it('TC-WS-019 filters by every word, runs the highlighted command and restores focus', async () => {
    const { store, user } = renderPalette();
    const opener = screen.getByRole('button', { name: 'Open palette' });

    await user.click(opener);
    const input = screen.getByRole('combobox', { name: 'Search commands' });
    expect(input).toHaveFocus();
    await user.type(input, 'tog side');
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Toggle sidebar']);
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);

    await user.keyboard('{Enter}');

    expect(store.getState().layout.visible.sidebar).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('TC-WS-019a arrow keys move the highlight, the mouse runs an option, and no match says so', async () => {
    const run = vi.fn();
    const commands: Command[] = [
      { id: 'a', title: 'Alpha', run },
      { id: 'b', title: 'Beta', run },
      { id: 'c', title: 'Gamma', shortcut: 'G', run },
    ];
    const { user } = renderPalette(commands);

    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('option', { name: /^Gamma/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{Home}{End}{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(run).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    await user.type(screen.getByRole('combobox'), 'zzz');

    expect(screen.getByText('No matching commands')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Enter}');
    expect(run).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    await user.tab();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('TC-WS-019b the built-in commands act on the active tab and the tree selection', () => {
    const store = createWorkspaceStore();
    const byId = (id: string): Command => {
      const command = WORKSPACE_COMMANDS.find((candidate) => candidate.id === id);
      if (command === undefined) {
        throw new Error(`no command ${id}`);
      }
      return command;
    };
    store.getState().openFile('my-plugin/readme.txt');
    store.getState().setDraft('my-plugin/readme.txt', 'draft');

    byId('file.save').run(store.getState());
    expect(store.getState().fs.read('my-plugin/readme.txt')).toEqual({ ok: true, value: 'draft' });
    byId('file.rename').run(store.getState());
    expect(store.getState().treeRequest).toMatchObject({
      kind: 'rename',
      path: 'my-plugin/readme.txt',
    });
    store.getState().setTreeSelection('my-plugin/includes');
    byId('folder.new').run(store.getState());
    expect(store.getState().treeRequest).toMatchObject({
      kind: 'new-folder',
      parent: 'my-plugin/includes',
    });
    store.getState().setTreeSelection('missing');
    byId('file.new').run(store.getState());
    expect(store.getState().treeRequest).toMatchObject({ kind: 'new-file', parent: '' });
    byId('tab.close').run(store.getState());
    expect(store.getState().tabs).toEqual([]);
    byId('tab.close').run(store.getState());
    byId('file.save').run(store.getState());
    byId('file.rename').run(store.getState());
    store.getState().setPanelSize('bottom', 300);
    byId('view.resetLayout').run(store.getState());
    expect(store.getState().layout.sizes.bottom).toBe(180);
    expect(filterCommands(WORKSPACE_COMMANDS, '  ')).toHaveLength(WORKSPACE_COMMANDS.length);
  });
});
