import { useId, useState } from 'react';

import { basename, dirname, isAncestor, type FsEntry } from '@/lib/fs';
import { Dialog, DialogActions } from '@/ui/Dialog';

import styles from './FileTree.module.css';

export interface DeleteDialogProps {
  path: string;
  kind: 'file' | 'directory';
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Delete x?" confirmation. Delete has focus so Delete, Enter confirms; Escape cancels. */
export function DeleteDialog({
  path,
  kind,
  onConfirm,
  onCancel,
}: DeleteDialogProps): React.JSX.Element {
  return (
    <Dialog
      role="alertdialog"
      title={`Delete ${basename(path)}?`}
      description={
        kind === 'directory'
          ? 'The folder and everything inside it will be removed. This cannot be undone.'
          : 'This cannot be undone.'
      }
      onClose={onCancel}
    >
      <DialogActions>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.dangerButton} data-autofocus onClick={onConfirm}>
          Delete
        </button>
      </DialogActions>
    </Dialog>
  );
}

export interface MoveDialogProps {
  path: string;
  entries: readonly FsEntry[];
  onMove: (folder: string) => void;
  onCancel: () => void;
}

/** Keyboard route for moving: pick a destination folder from a list. */
export function MoveDialog({
  path,
  entries,
  onMove,
  onCancel,
}: MoveDialogProps): React.JSX.Element {
  const selectId = useId();
  const parent = dirname(path);
  const folders = entries
    .filter((entry) => entry.kind === 'directory')
    .map((entry) => entry.path)
    .filter((folder) => folder !== path && folder !== parent && !isAncestor(path, folder));
  const options = parent === '' ? folders : ['', ...folders];
  const [folder, setFolder] = useState<string>(options[0] ?? '');

  return (
    <Dialog title={`Move ${basename(path)}`} onClose={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onMove(folder);
        }}
      >
        <label htmlFor={selectId} className={styles.fieldLabel}>
          Destination folder
        </label>
        <select
          id={selectId}
          className={styles.select}
          data-autofocus
          value={folder}
          disabled={options.length === 0}
          onChange={(event) => {
            setFolder(event.target.value);
          }}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option === '' ? 'Project root' : option}
            </option>
          ))}
        </select>
        {options.length === 0 ? (
          <p className={styles.hint}>There is no other folder to move this to.</p>
        ) : null}
        <DialogActions>
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.primaryButton} disabled={options.length === 0}>
            Move
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
