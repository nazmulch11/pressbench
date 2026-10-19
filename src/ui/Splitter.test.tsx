import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Splitter } from './Splitter';

function renderSplitter(props: Partial<React.ComponentProps<typeof Splitter>> = {}) {
  const onChange = vi.fn<(value: number) => void>();
  const onCommit = vi.fn<(value: number) => void>();
  render(
    <Splitter
      label="Resize sidebar"
      orientation="vertical"
      value={200}
      min={100}
      max={300}
      step={16}
      onChange={onChange}
      onCommit={onCommit}
      {...props}
    />,
  );
  return {
    onChange,
    onCommit,
    separator: screen.getByRole('separator', { name: 'Resize sidebar' }),
  };
}

describe('Splitter', () => {
  it('TC-WS-020 resizes by one step per arrow key and clamps at Home and End', async () => {
    const user = userEvent.setup();
    const { onChange, onCommit, separator } = renderSplitter();

    separator.focus();
    await user.keyboard('{ArrowRight}{ArrowLeft}{End}{Home}');

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([216, 184, 300, 100]);
    expect(onCommit.mock.calls.map(([value]) => value)).toEqual([216, 184, 300, 100]);
    expect(separator).toHaveAttribute('aria-valuenow', '200');
    expect(separator).toHaveAttribute('aria-valuemin', '100');
    expect(separator).toHaveAttribute('aria-valuemax', '300');
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('TC-WS-020a inverted and horizontal splitters move the other way', async () => {
    const user = userEvent.setup();
    const { onChange, separator } = renderSplitter({ orientation: 'horizontal', invert: true });

    separator.focus();
    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowRight}');

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([184, 216]);
  });

  it('TC-WS-020b follows the pointer while dragging and stops on release', () => {
    const { onChange, onCommit, separator } = renderSplitter({ invert: false });

    fireEvent.pointerDown(separator, { button: 0, clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 80, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 10, pointerId: 1 });

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([230, 170]);
    expect(onCommit.mock.calls.map(([value]) => value)).toEqual([170]);
    expect(separator).not.toHaveAttribute('data-dragging');
  });
});
