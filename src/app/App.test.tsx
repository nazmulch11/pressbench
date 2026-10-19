import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createFakePlaygroundService } from '@/lib/playground';
import { createWorkspaceStore, type WorkspaceStore } from '@/stores';

import { App } from './App';

function renderApp(): { store: WorkspaceStore; user: ReturnType<typeof userEvent.setup> } {
  const store = createWorkspaceStore();
  render(<App playground={createFakePlaygroundService()} store={store} />);
  return { store, user: userEvent.setup() };
}

const treeItem = (name: string) => screen.getByRole('treeitem', { name });
const tabs = () => screen.getByRole('list', { name: 'Open files' });
const tab = (name: string) => within(tabs()).getByRole('button', { name });
const editor = () => screen.getByRole('textbox', { name: /^Editor: / });

describe('App', () => {
  it('TC-FND-001a renders the product name as the main heading', () => {
    renderApp();

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pressbench' })).toBeInTheDocument();
  });

  it('TC-WS-003 creates a file from the folder context menu, sorted, and opens it', async () => {
    const { user } = renderApp();

    await user.pointer({ keys: '[MouseRight]', target: treeItem('my-plugin') });
    await user.click(screen.getByRole('menuitem', { name: 'New file' }));
    await user.type(screen.getByRole('textbox', { name: 'New file name' }), 'a.php{Enter}');

    const names = screen.getAllByRole('treeitem').map((item) => item.textContent);
    expect(names).toEqual([
      'my-plugin',
      'assets',
      'style.css',
      'includes',
      'class-my-plugin.php',
      'a.php',
      'my-plugin.php',
      'readme.txt',
    ]);
    expect(tab('a.php')).toHaveAttribute('aria-current', 'true');
    expect(editor()).toHaveAccessibleName('Editor: my-plugin/a.php');
  });

  it('TC-WS-004 renames a file and the open tab follows', async () => {
    const { user } = renderApp();
    await user.click(treeItem('readme.txt'));
    expect(tab('readme.txt')).toBeInTheDocument();

    treeItem('readme.txt').focus();
    await user.keyboard('{F2}');
    const input = screen.getByRole('textbox', { name: 'New name' });
    await user.clear(input);
    await user.type(input, 'readme.md{Enter}');

    expect(treeItem('readme.md')).toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'readme.txt' })).not.toBeInTheDocument();
    expect(tab('readme.md')).toHaveAttribute('aria-current', 'true');
    expect(within(tabs()).queryByRole('button', { name: 'readme.txt' })).not.toBeInTheDocument();
  });

  it('TC-WS-005 asks before deleting; confirm removes the file and its tab', async () => {
    const { store, user } = renderApp();
    await user.click(treeItem('readme.txt'));

    treeItem('readme.txt').focus();
    await user.keyboard('{Delete}');
    const dialog = screen.getByRole('alertdialog', { name: 'Delete readme.txt?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(treeItem('readme.txt')).toBeInTheDocument();
    expect(tab('readme.txt')).toBeInTheDocument();

    await user.keyboard('{Delete}');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryByRole('treeitem', { name: 'readme.txt' })).not.toBeInTheDocument();
    expect(within(tabs()).queryByRole('button', { name: /readme\.txt/ })).not.toBeInTheDocument();
    expect(store.getState().fs.exists('my-plugin/readme.txt')).toBe(false);
  });

  it('TC-WS-011b the New file command opens the name input next to the tree selection', async () => {
    const { user } = renderApp();
    await user.click(treeItem('class-my-plugin.php'));

    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox', { name: 'Search commands' }), 'new file');
    await user.keyboard('{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'New file name' }), 'helpers.php{Enter}');

    expect(treeItem('helpers.php')).toHaveAttribute('data-path', 'my-plugin/includes/helpers.php');
  });
});
