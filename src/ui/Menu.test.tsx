import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Menu } from './Menu';

function renderMenu() {
  const onClose = vi.fn();
  const onSelect = vi.fn<(id: string) => void>();
  render(
    <>
      <button type="button">outside</button>
      <Menu
        label="File actions"
        position={{ x: 10, y: 20 }}
        onClose={onClose}
        items={[
          {
            id: 'open',
            label: 'Open',
            shortcut: 'Enter',
            onSelect: () => {
              onSelect('open');
            },
          },
          {
            id: 'gone',
            label: 'Disabled',
            disabled: true,
            onSelect: () => {
              onSelect('gone');
            },
          },
          {
            id: 'rename',
            label: 'Rename',
            onSelect: () => {
              onSelect('rename');
            },
          },
        ]}
      />
    </>,
  );
  return { onClose, onSelect, user: userEvent.setup() };
}

describe('Menu', () => {
  it('TC-WS-008e focuses the first item and moves with arrows, Home and End, skipping disabled items', async () => {
    const { user } = renderMenu();

    expect(screen.getByRole('menuitem', { name: /^Open/ })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /^Open/ })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: /^Open/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
  });

  it('TC-WS-008f Enter runs the item and closes; Escape, Tab and a click outside only close', async () => {
    const { onClose, onSelect, user } = renderMenu();

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('open');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.keyboard('{Tab}');
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));
    expect(onClose).toHaveBeenCalledTimes(4);
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(onClose).toHaveBeenCalledTimes(4);
    await user.click(screen.getByRole('menuitem', { name: 'Disabled' }));
    expect(onSelect).not.toHaveBeenCalledWith('gone');
  });
});
