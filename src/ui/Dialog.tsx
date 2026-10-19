import { useEffect, useId, useRef, type ReactNode } from 'react';

import styles from './Dialog.module.css';

export interface DialogProps {
  /** `alertdialog` for confirmations that interrupt; `dialog` for everything else. */
  role?: 'dialog' | 'alertdialog';
  title: string;
  description?: string;
  /** Called for Escape and the backdrop. */
  onClose: () => void;
  children: ReactNode;
  /** Extra class for the panel, for wide dialogs. */
  className?: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/**
 * A modal panel rendered in place. Focus moves to the first `data-autofocus` element (else the first focusable),
 * stays inside while open, and returns to the opener on close.
 */
export function Dialog({
  role = 'dialog',
  title,
  description,
  onClose,
  children,
  className,
}: DialogProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const panel = panelRef.current;
    const opener = document.activeElement;
    if (panel !== null) {
      const preferred = panel.querySelector<HTMLElement>('[data-autofocus]');
      (preferred ?? focusables(panel)[0] ?? panel).focus();
    }
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || panelRef.current === null) {
      return;
    }
    const items = focusables(panelRef.current);
    const first = items[0];
    const last = items.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={styles.backdrop} onPointerDown={onClose}>
      {/* The panel stops backdrop pointer events; keyboard handling is on the focusable panel itself. */}
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        {...(description === undefined ? {} : { 'aria-describedby': descriptionId })}
        tabIndex={-1}
        className={[styles.panel, className].filter(Boolean).join(' ')}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description === undefined ? null : (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

export interface DialogActionsProps {
  children: ReactNode;
}

/** Right-aligned button row for a {@link Dialog}. */
export function DialogActions({ children }: DialogActionsProps): React.JSX.Element {
  return <div className={styles.actions}>{children}</div>;
}
