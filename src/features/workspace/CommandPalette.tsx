import { useEffect, useId, useRef, useState } from 'react';

import { useWorkspaceStore, useWorkspaceStoreApi } from '@/stores';

import styles from './CommandPalette.module.css';
import { filterCommands, WORKSPACE_COMMANDS, type Command } from './commands';

export interface CommandPaletteProps {
  commands?: readonly Command[];
}

/**
 * Ctrl/Cmd+K command palette: a combobox over a listbox of commands. Enter runs the highlighted command, Escape
 * closes and focus returns to where it was.
 */
export function CommandPalette({
  commands = WORKSPACE_COMMANDS,
}: CommandPaletteProps): React.JSX.Element | null {
  const api = useWorkspaceStoreApi();
  const isOpen = useWorkspaceStore((state) => state.isPaletteOpen);
  if (!isOpen) {
    return null;
  }
  return (
    <PaletteDialog
      commands={commands}
      close={() => {
        api.getState().closePalette();
      }}
    />
  );
}

function PaletteDialog({
  commands,
  close,
}: {
  commands: readonly Command[];
  close: () => void;
}): React.JSX.Element {
  const api = useWorkspaceStoreApi();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const titleId = useId();
  const matches = filterCommands(commands, query);
  const active = matches[Math.min(highlighted, Math.max(matches.length - 1, 0))];

  useEffect(() => {
    const opener = document.activeElement;
    inputRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, []);

  function run(command: Command | undefined): void {
    close();
    if (command !== undefined) {
      command.run(api.getState());
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    switch (event.key) {
      case 'ArrowDown':
        setHighlighted((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)));
        break;
      case 'ArrowUp':
        setHighlighted((current) => Math.max(current - 1, 0));
        break;
      case 'Home':
        setHighlighted(0);
        break;
      case 'End':
        setHighlighted(Math.max(matches.length - 1, 0));
        break;
      case 'Enter':
        run(active);
        break;
      case 'Escape':
        close();
        break;
      case 'Tab':
        // The input is the only focusable control; Tab stays inside the modal.
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  const optionId = (command: Command): string => `${listId}-${command.id}`;

  return (
    <div className={styles.backdrop} onPointerDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.panel}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 id={titleId} className="visually-hidden">
          Command palette
        </h2>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search commands"
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          {...(active === undefined ? {} : { 'aria-activedescendant': optionId(active) })}
          className={styles.input}
          placeholder="Type a command"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={onKeyDown}
        />
        {matches.length === 0 ? null : (
          <ul id={listId} role="listbox" aria-label="Commands" className={styles.list}>
            {matches.map((command) => (
              // Options are reached through the combobox (aria-activedescendant); the mouse clicks them directly.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keyboard runs via the combobox
              <li
                key={command.id}
                id={optionId(command)}
                role="option"
                aria-selected={command === active}
                className={styles.option}
                onPointerMove={() => {
                  setHighlighted(matches.indexOf(command));
                }}
                onClick={() => {
                  run(command);
                }}
              >
                <span>{command.title}</span>
                {command.shortcut === undefined ? null : (
                  <kbd className={styles.shortcut}>{command.shortcut}</kbd>
                )}
              </li>
            ))}
          </ul>
        )}
        {matches.length === 0 ? (
          <p aria-live="polite" className={styles.empty}>
            No matching commands
          </p>
        ) : null}
      </div>
    </div>
  );
}
