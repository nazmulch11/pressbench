import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Dialog, DialogActions } from './Dialog';

describe('Dialog', () => {
  it('TC-WS-024a traps Tab inside, closes on Escape and the backdrop, and restores focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<button type="button">opener</button>);
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    const { unmount } = render(
      <Dialog role="alertdialog" title="Delete it?" description="Gone for good." onClose={onClose}>
        <DialogActions>
          <button type="button">Cancel</button>
          <button type="button" data-autofocus>
            Delete
          </button>
        </DialogActions>
      </Dialog>,
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Delete it?' });
    expect(dialog).toHaveAccessibleDescription('Gone for good.');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.pointerDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();

    expect(opener).toHaveFocus();
  });

  it('TC-WS-024b focuses the panel itself when nothing inside is focusable', () => {
    render(
      <Dialog title="Notice" onClose={vi.fn()}>
        <p>Nothing to press.</p>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Notice' });

    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog).toHaveFocus();
  });
});
