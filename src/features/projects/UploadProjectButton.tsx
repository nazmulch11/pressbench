import { useRef } from 'react';

import styles from './UploadProjectButton.module.css';
import { useProjectUpload } from './useProjectUpload';

/**
 * "Upload plugin or theme": reads a WordPress plugin or theme zip and adds its folder to the project, then
 * opens its main file. The zip is untrusted input; `readProjectZip` checks every path and size first.
 */
export function UploadProjectButton(): React.JSX.Element {
  const { message, messageId, isBusy, upload, dismiss } = useProjectUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.upload}>
      <button
        type="button"
        className={styles.button}
        disabled={isBusy}
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        Upload plugin or theme
      </button>
      <input
        ref={inputRef}
        className={styles.input}
        type="file"
        accept=".zip,application/zip"
        aria-label="Plugin or theme zip file"
        tabIndex={-1}
        onChange={(event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          // Cleared so choosing the same file again (after renaming a clashing folder) fires another change.
          input.value = '';
          if (file !== undefined) {
            void upload(file);
          }
        }}
      />
      <div className={styles.live} aria-live="polite">
        {message === '' ? null : (
          <div key={messageId} className={styles.message}>
            <p className={styles.text}>{message}</p>
            <button type="button" className={styles.dismiss} onClick={dismiss}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
