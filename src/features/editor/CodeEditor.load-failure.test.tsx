import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createWorkspaceStore, WorkspaceStoreProvider } from '@/stores';

import { CodeEditor } from './CodeEditor';

// The Monaco chunk fails to download, as after a deploy that removed the old chunk files.
vi.mock('./MonacoEditor', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

describe('CodeEditor when the editor chunk cannot load', () => {
  it('TC-ED-028 explains the failure in the editor slot and leaves the rest of the workspace working', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = createWorkspaceStore();
    render(
      <WorkspaceStoreProvider store={store}>
        <p>Rest of the workspace</p>
        <CodeEditor />
      </WorkspaceStoreProvider>,
    );

    act(() => {
      store.getState().openFile('my-plugin/readme.txt');
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The editor could not be loaded. Your files and unsaved changes are still here; reload the page to try again.',
    );
    expect(screen.getByText('Rest of the workspace')).toBeVisible();
    act(() => {
      store.getState().openFile('my-plugin/my-plugin.php');
    });
    expect(screen.getByRole('alert')).toBeVisible();
    consoleError.mockRestore();
  });
});
