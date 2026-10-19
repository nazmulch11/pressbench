import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import styles from './Menu.module.css';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  /** Shown at the right, for example "F2". */
  readonly shortcut?: string;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export interface MenuProps {
  label: string;
  items: readonly MenuItem[];
  /** Viewport position of the top-left corner. */
  position: { x: number; y: number };
  /** Called after an item runs, on Escape, and on a click outside. */
  onClose: () => void;
}

/**
 * A context menu (`role="menu"`). Focus lands on the first item; arrow keys, Home and End move; Enter or Space
 * select; Escape closes. The caller restores focus to the element the menu was opened for.
 */
export function Menu({ label, items, position, onClose }: MenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(position);

  // Keep the menu inside the viewport: rows near the bottom or right edge would otherwise open off-screen.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) {
      return;
    }
    const { width, height } = menu.getBoundingClientRect();
    const x = Math.max(0, Math.min(position.x, window.innerWidth - width - 8));
    const y = Math.max(0, Math.min(position.y, window.innerHeight - height - 8));
    setPlaced({ x, y });
  }, [position]);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const onPointerDown = (event: PointerEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const buttons = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ??
        []),
    ];
    const index = buttons.findIndex((button) => button === document.activeElement);
    const focusAt = (next: number): void => {
      buttons.at(((next % buttons.length) + buttons.length) % buttons.length)?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(-1);
        break;
      case 'Escape':
      case 'Tab':
        onClose();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label={label}
      className={styles.menu}
      style={{ left: placed.x, top: placed.y }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={styles.item}
          disabled={item.disabled === true}
          tabIndex={-1}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          <span>{item.label}</span>
          {item.shortcut === undefined ? null : (
            <kbd className={styles.shortcut}>{item.shortcut}</kbd>
          )}
        </button>
      ))}
    </div>
  );
}
