import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createWorkspaceStore, WorkspaceStoreProvider, type WorkspaceStore } from '@/stores';

import { Workspace } from './Workspace';

function renderWorkspace(): { store: WorkspaceStore; user: ReturnType<typeof userEvent.setup> } {
  const store = createWorkspaceStore();
  render(
    <WorkspaceStoreProvider store={store}>
      <Workspace sidebar={<p>sidebar slot</p>} preview={<p>preview slot</p>} />
    </WorkspaceStoreProvider>,
  );
  return { store, user: userEvent.setup() };
}

const tabs = () => screen.getByRole('list', { name: 'Open files' });
const tab = (name: string) => within(tabs()).getByRole('button', { name });
const editor = () => screen.getByRole('textbox', { name: /^Editor: / });

describe('Workspace', () => {
  it('TC-WS-009 opens three tabs and Ctrl/Cmd+W closes the active one', async () => {
    const { store, user } = renderWorkspace();
    for (const path of [
      'my-plugin/my-plugin.php',
      'my-plugin/readme.txt',
      'my-plugin/assets/style.css',
    ]) {
      act(() => {
        store.getState().openFile(path);
      });
    }
    await user.click(tab('readme.txt'));

    await user.keyboard('{Control>}w{/Control}');

    const remaining = within(tabs()).getAllByRole('listitem');
    expect(remaining).toHaveLength(2);
    expect(tab('style.css')).toHaveAttribute('aria-current', 'true');
    await user.keyboard('{Meta>}w{/Meta}');
    expect(tab('my-plugin.php')).toHaveAttribute('aria-current', 'true');
    expect(within(tabs()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('TC-WS-023 Ctrl/Cmd+S writes the draft and clears the unsaved marker', async () => {
    const { store, user } = renderWorkspace();
    act(() => {
      store.getState().openFile('my-plugin/readme.txt');
    });

    await user.click(editor());
    await user.keyboard('Edited: ');
    expect(tab('readme.txt, unsaved')).toBeInTheDocument();
    await user.keyboard('{Control>}s{/Control}');

    expect(tab('readme.txt')).toBeInTheDocument();
    const saved = store.getState().fs.read('my-plugin/readme.txt');
    expect(saved.ok && saved.value.endsWith('Edited: ')).toBe(true);
  });

  it('TC-WS-024 close with unsaved changes offers Cancel, Don’t save and Save', async () => {
    const { store, user } = renderWorkspace();
    const original = store.getState().fs.read('my-plugin/assets/style.css');
    const open = (): void => {
      act(() => {
        store.getState().openFile('my-plugin/assets/style.css');
      });
    };
    open();
    await user.click(editor());
    await user.keyboard('/* draft */');

    await user.click(tab('Close style.css'));
    expect(screen.getByRole('alertdialog', { name: 'Save changes to style.css?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(tab('style.css, unsaved')).toBeInTheDocument();
    expect((editor() as HTMLTextAreaElement).value).toContain('/* draft */');

    await user.click(tab('Close style.css'));
    await user.click(screen.getByRole('button', { name: "Don't save" }));
    expect(within(tabs()).queryAllByRole('listitem')).toHaveLength(0);
    expect(store.getState().fs.read('my-plugin/assets/style.css')).toEqual(original);

    open();
    await user.click(editor());
    await user.keyboard('/* kept */');
    await user.click(tab('Close style.css'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(within(tabs()).queryAllByRole('listitem')).toHaveLength(0);
    expect(store.getState().fs.read('my-plugin/assets/style.css')).toMatchObject({
      ok: true,
      value: expect.stringContaining('/* kept */') as string,
    });
  });

  it('TC-WS-025 toggles the sidebar, preview and bottom panel from the palette', async () => {
    const { user } = renderWorkspace();
    const toggle = async (command: string): Promise<void> => {
      await user.click(screen.getByRole('button', { name: /^Commands/ }));
      await user.type(screen.getByRole('combobox', { name: 'Search commands' }), command);
      await user.keyboard('{Enter}');
    };

    await toggle('toggle sidebar');
    expect(screen.queryByRole('region', { name: 'Files' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Editor' })).toBeVisible();
    await toggle('toggle sidebar');
    expect(screen.getByRole('region', { name: 'Files' })).toHaveTextContent('sidebar slot');

    await toggle('toggle preview');
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
    await toggle('toggle preview');
    expect(screen.getByRole('region', { name: 'Preview' })).toHaveTextContent('preview slot');

    await toggle('toggle bottom');
    expect(screen.queryByRole('region', { name: 'Bottom panel' })).not.toBeInTheDocument();
    await toggle('toggle bottom');
    expect(screen.getByRole('region', { name: 'Bottom panel' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Editor' })).toBeVisible();
  });
});
