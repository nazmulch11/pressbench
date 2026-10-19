import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createWorkspaceStore, WorkspaceStoreProvider } from '@/stores';

import { TabBar } from './TabBar';

const FILES = ['my-plugin/my-plugin.php', 'my-plugin/readme.txt', 'my-plugin/assets/style.css'];

function renderTabs() {
  const store = createWorkspaceStore();
  for (const path of FILES) {
    store.getState().openFile(path);
  }
  store.getState().activateTab('my-plugin/my-plugin.php');
  render(
    <WorkspaceStoreProvider store={store}>
      <TabBar />
    </WorkspaceStoreProvider>,
  );
  return { store, user: userEvent.setup() };
}

const names = () =>
  within(screen.getByRole('list', { name: 'Open files' }))
    .getAllByRole('listitem')
    .map((item) => within(item).getAllByRole('button')[0]?.getAttribute('aria-label'));

describe('TabBar', () => {
  it('TC-WS-018 reorders with Alt+Shift+Arrow and by dragging one tab over another', async () => {
    const { store, user } = renderTabs();

    screen.getByRole('button', { name: 'my-plugin.php' }).focus();
    await user.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    expect(names()).toEqual(['readme.txt', 'my-plugin.php', 'style.css']);
    expect(screen.getByRole('button', { name: 'my-plugin.php' })).toHaveFocus();
    await user.keyboard('{Alt>}{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}{/Alt}');
    expect(names()).toEqual(['my-plugin.php', 'readme.txt', 'style.css']);

    const list = screen.getByRole('list', { name: 'Open files' });
    const last = screen.getByRole('button', { name: 'style.css' });
    fireEvent.pointerDown(last, { button: 0, clientX: 300, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(list, { clientX: 200, clientY: 10, pointerId: 1 });
    fireEvent.pointerEnter(within(list).getAllByRole('listitem')[0]!, {
      clientX: 20,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerUp(list, { clientX: 20, clientY: 10, pointerId: 1 });

    expect(names()).toEqual(['style.css', 'my-plugin.php', 'readme.txt']);
    expect(store.getState().activeTab).toBe('my-plugin/my-plugin.php');
    expect(screen.getByRole('button', { name: 'my-plugin.php' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('TC-WS-018a a click activates, the close button closes, a middle click closes', async () => {
    const { store, user } = renderTabs();

    await user.click(screen.getByRole('button', { name: 'readme.txt' }));
    expect(store.getState().activeTab).toBe('my-plugin/readme.txt');
    await user.click(screen.getByRole('button', { name: 'Close readme.txt' }));
    expect(names()).toEqual(['my-plugin.php', 'style.css']);
    fireEvent(
      screen.getByRole('button', { name: 'style.css' }),
      new MouseEvent('auxclick', { button: 1, bubbles: true }),
    );

    expect(names()).toEqual(['my-plugin.php']);
  });

  it('TC-WS-018b shows the unsaved marker in the accessible name', () => {
    const { store } = renderTabs();

    act(() => {
      store.getState().setDraft('my-plugin/readme.txt', 'changed');
    });

    expect(screen.getByRole('button', { name: 'readme.txt, unsaved' })).toBeInTheDocument();
  });
});
