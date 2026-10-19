import { useEffect, useId, useRef, useState } from 'react';

import type { FsError } from '@/lib/fs';
import type { Result } from '@/lib/result';

import styles from './FileTree.module.css';

export interface NameEditorProps {
  /** Accessible name of the input, for example "New file name". */
  label: string;
  initialValue?: string;
  /** Returns the outcome; on failure the message is shown and the input stays. */
  onSubmit: (name: string) => Result<unknown, FsError>;
  onCancel: () => void;
}

/** Inline name input for creating and renaming. Enter submits, Escape or leaving the field cancels. */
export function NameEditor({
  label,
  initialValue = '',
  onSubmit,
  onCancel,
}: NameEditorProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input === null) {
      return;
    }
    input.focus();
    // Select the stem so typing replaces the name and keeps the extension.
    const dot = initialValue.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : initialValue.length);
  }, [initialValue]);

  function submit(): void {
    const value = inputRef.current?.value.trim() ?? '';
    const result = onSubmit(value);
    if (!result.ok) {
      setError(result.error.message);
    }
  }

  return (
    <form
      className={styles.editor}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submit();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        aria-label={label}
        aria-invalid={error !== null}
        {...(error === null ? {} : { 'aria-describedby': errorId })}
        defaultValue={initialValue}
        autoComplete="off"
        spellCheck={false}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        onChange={() => {
          setError(null);
        }}
        onBlur={onCancel}
      />
      {error === null ? null : (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
