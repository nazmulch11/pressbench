import { useEffect, useState } from 'react';

import styles from './Splitter.module.css';

export interface SplitterProps {
  /** Accessible name, for example "Resize sidebar". */
  label: string;
  /** A `vertical` separator sits between side-by-side panes and resizes widths. */
  orientation: 'vertical' | 'horizontal';
  /** Current size of the controlled pane in pixels. */
  value: number;
  min: number;
  max: number;
  /** Pixels per arrow-key press. */
  step: number;
  /** Set when the pane is on the far side: moving the splitter right or down makes it smaller. */
  invert?: boolean;
  onChange: (value: number) => void;
  /** Called once when a drag ends or after a key press, with the final value; for persisting. */
  onCommit?: (value: number) => void;
}

interface DragStart {
  readonly pointer: number;
  readonly value: number;
}

/**
 * A keyboard- and pointer-operable pane divider (`role="separator"`). Reports new sizes; the parent clamps and
 * stores them.
 */
export function Splitter({
  label,
  orientation,
  value,
  min,
  max,
  step,
  invert = false,
  onChange,
  onCommit,
}: SplitterProps): React.JSX.Element {
  const [drag, setDrag] = useState<DragStart | null>(null);
  const axis = orientation === 'vertical' ? 'clientX' : 'clientY';
  const clamp = (next: number): number => Math.min(max, Math.max(min, next));

  useEffect(() => {
    if (drag === null) {
      return undefined;
    }
    let latest = value;
    const onMove = (event: PointerEvent): void => {
      const delta = event[axis] - drag.pointer;
      latest = Math.min(max, Math.max(min, drag.value + (invert ? -delta : delta)));
      onChange(latest);
    };
    const onEnd = (): void => {
      setDrag(null);
      onCommit?.(latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
    // `value` is read once at drag start on purpose; moves track `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [drag, axis, onChange, onCommit, invert, min, max]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const grow = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
    const shrink = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
    const direction = invert ? -1 : 1;
    let next: number | null = null;
    if (event.key === grow) {
      next = value + step * direction;
    } else if (event.key === shrink) {
      next = value - step * direction;
    } else if (event.key === 'Home') {
      next = min;
    } else if (event.key === 'End') {
      next = max;
    }
    if (next !== null) {
      event.preventDefault();
      onChange(clamp(next));
      onCommit?.(clamp(next));
    }
  }

  // ARIA: a focusable separator is a widget (a resizable splitter), which jsx-a11y does not model.
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={styles.splitter}
      data-orientation={orientation}
      {...(drag === null ? {} : { 'data-dragging': 'true' })}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button === 0) {
          event.preventDefault();
          setDrag({ pointer: event[axis], value });
        }
      }}
    />
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}
